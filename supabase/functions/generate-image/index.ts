// Supabase Edge Function: generate-image
// Deploy with: supabase functions deploy generate-image
//
// Proxies requests to a custom AI image generation API.
// Downloads the generated image and uploads to Supabase Storage.
// Supports per-model configuration via request body (apiEndpoint, apiKey, model)
// Falls back to IMAGE_API_URL / IMAGE_API_KEY env vars if not provided in request.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

interface GenerateRequest {
  prompt: string;
  aspectRatio?: string;
  engine?: string;
  recordId: string;
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
  protocol?: string;
}

interface GenerationResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  url?: string;
  image_url?: string;
  imageUrl?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getEnv(key: string, defaultValue?: string): string | undefined {
  return Deno.env.get(key) || defaultValue;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const body: GenerateRequest = await req.json();
    const {
      prompt,
      aspectRatio = '1:1',
      engine = 'gpt-image-2',
      recordId,
      apiEndpoint,
      apiKey,
      model,
      protocol = 'openai',
    } = body;

    console.log('[GEN] ========== REQUEST START ==========');
    console.log('[GEN] userId:', user.id);
    console.log('[GEN] recordId:', recordId);
    console.log('[GEN] engine:', engine);
    console.log('[GEN] model:', model);
    console.log('[GEN] protocol:', protocol);
    console.log('[GEN] prompt:', prompt?.slice(0, 100));
    console.log('[GEN] aspectRatio:', aspectRatio);

    if (!prompt?.trim()) {
      console.error('[GEN] ERROR: Prompt is required');
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!recordId) {
      console.error('[GEN] ERROR: recordId is required');
      return new Response(JSON.stringify({ error: 'recordId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve API config: request body takes priority, then env vars
    const imageApiUrl = apiEndpoint || getEnv('IMAGE_API_URL', 'http://43.153.120.226:30003/v1/images/generations');
    const imageApiKey = apiKey || getEnv('IMAGE_API_KEY');
    const modelName = model || engine;

    console.log('[GEN] API config:', { imageApiUrl, modelName, protocol, hasApiKey: !!imageApiKey });

    if (!imageApiUrl) {
      console.error('[GEN] ERROR: Missing API endpoint');
      return new Response(JSON.stringify({ error: 'Missing API endpoint configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!imageApiKey) {
      console.error('[GEN] ERROR: Missing API key');
      return new Response(JSON.stringify({ error: 'Missing API key configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update status to generating
    console.log('[LC] pending → generating | recordId:', recordId);
    const { error: genUpdateError } = await supabase
      .from('generations')
      .update({ status: 'generating', picture_lifecycle: 'generating' })
      .eq('id', recordId)
      .eq('user_id', user.id);
    if (genUpdateError) {
      console.error('[LC] DB update error (generating):', genUpdateError);
    } else {
      console.log('[LC] DB updated: pending → generating ✓');
    }

    // Map aspect ratio to size
    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1024x576',
      '3:4': '768x1024',
      '9:16': '576x1024',
    };
    const size = sizeMap[aspectRatio] || '1024x1024';
    const [imgWidth, imgHeight] = size.split('x').map(Number);

    // Build request body based on protocol
    function buildRequestBody(): Record<string, unknown> {
      switch (protocol) {
        case 'stability':
          return {
            text_prompts: [{ text: prompt.trim(), weight: 1 }],
            cfg_scale: 7,
            steps: 30,
            width: imgWidth,
            height: imgHeight,
            samples: 1,
          };
        case 'midjourney':
          return {
            prompt: prompt.trim(),
            aspect_ratio: aspectRatio,
            model: modelName,
          };
        case 'custom':
          return {
            model: modelName,
            prompt: prompt.trim(),
            n: 1,
            size,
          };
        case 'openai':
        default:
          return {
            model: modelName,
            prompt: prompt.trim(),
            n: 1,
            size,
          };
      }
    }

    // Call external AI image generation API
    const requestBody = buildRequestBody();
    console.log('[GEN] Calling external API:', imageApiUrl);
    console.log('[GEN] Request body:', JSON.stringify(requestBody));

    const apiResponse = await fetch(imageApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${imageApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('[GEN] API error:', apiResponse.status, errorText);
      console.log('[LC] generating → expired (API failed) | recordId:', recordId);
      await supabase
        .from('generations')
        .update({ status: 'failed', picture_lifecycle: 'expired' })
        .eq('id', recordId)
        .eq('user_id', user.id);
      console.log('[LC] DB updated: generating → expired (API failed) ✓');
      return new Response(
        JSON.stringify({ error: `Image generation failed: ${apiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiData: GenerationResponse = await apiResponse.json();
    console.log('[GEN] API response:', JSON.stringify(apiData).slice(0, 500));

    // Helper: resolve relative URLs
    function resolveUrl(url: string): string {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      const base = imageApiUrl.replace(/\/v1\/.*$/, '').replace(/\/+$/, '');
      return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    // Extract image URL or base64 from response
    let imageUrl: string | null = null;
    let imageBuffer: Uint8Array | null = null;

    if (apiData.data && apiData.data[0]) {
      const first = apiData.data[0];
      if (first.url) {
        imageUrl = resolveUrl(first.url);
      } else if (first.b64_json) {
        imageBuffer = Uint8Array.from(atob(first.b64_json), c => c.charCodeAt(0));
      }
    } else if (apiData.url) {
      imageUrl = resolveUrl(apiData.url);
    } else if (apiData.image_url) {
      imageUrl = resolveUrl(apiData.image_url);
    } else if (apiData.imageUrl) {
      imageUrl = resolveUrl(apiData.imageUrl);
    }

    if (!imageUrl && !imageBuffer) {
      console.error('[GEN] ERROR: No image URL or buffer in response');
      console.log('[LC] generating → expired (no image data) | recordId:', recordId);
      await supabase
        .from('generations')
        .update({ status: 'failed', picture_lifecycle: 'expired' })
        .eq('id', recordId)
        .eq('user_id', user.id);
      console.log('[LC] DB updated: generating → expired (no image data) ✓');
      return new Response(
        JSON.stringify({ error: 'No image returned from generation API' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GEN] Extracted imageUrl:', imageUrl ? imageUrl.slice(0, 100) : 'null');
    console.log('[GEN] Has imageBuffer:', !!imageBuffer);

    // Download image if URL provided
    if (imageUrl && !imageBuffer) {
      console.log('[GEN] Downloading image from:', imageUrl.slice(0, 100));
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error('[GEN] Download error:', imageResponse.status, imageUrl);
        console.log('[LC] generating → expired (download failed) | recordId:', recordId);
        await supabase
          .from('generations')
          .update({ status: 'failed', picture_lifecycle: 'expired' })
          .eq('id', recordId)
          .eq('user_id', user.id);
        console.log('[LC] DB updated: generating → expired (download failed) ✓');
        return new Response(
          JSON.stringify({ error: 'Failed to download generated image' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
      console.log('[GEN] Downloaded image size:', imageBuffer.length, 'bytes');
    }

    // Resolve picture_id: use existing or generate new (timestamp + random for traceability)
    const { data: recordData } = await supabase
      .from('generations')
      .select('picture_id')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .single();

    const pictureId = recordData?.picture_id || `ts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('[GEN] pictureId:', pictureId);

    // Upload to Supabase Storage using picture_id as filename
    const filePath = `${user.id}/${pictureId}.png`;
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, imageBuffer!, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('[GEN] Upload error:', uploadError);
      console.log('[LC] generating → expired (upload failed) | recordId:', recordId);
      await supabase
        .from('generations')
        .update({ status: 'failed', picture_lifecycle: 'expired' })
        .eq('id', recordId)
        .eq('user_id', user.id);
      console.log('[LC] DB updated: generating → expired (upload failed) ✓');
      return new Response(
        JSON.stringify({ error: 'Failed to upload image to storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[GEN] Upload success, path:', filePath);

    // Get public URL
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // Update record with the image URL, picture_id and lifecycle
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log('[LC] generating → active (success) | recordId:', recordId);
    console.log('[LC]   pictureId:', pictureId);
    console.log('[LC]   expiresAt:', expiresAt.toISOString());
    console.log('[LC]   publicUrl:', publicUrl.slice(0, 100));
    const { error: finalUpdateError } = await supabase
      .from('generations')
      .update({
        status: 'completed',
        image_url: publicUrl,
        picture_id: pictureId,
        picture_expires_at: expiresAt.toISOString(),
        picture_lifecycle: 'active',
      })
      .eq('id', recordId)
      .eq('user_id', user.id);

    if (finalUpdateError) {
      console.error('[LC] DB final update error:', finalUpdateError);
    } else {
      console.log('[LC] DB updated: generating → active ✓');
    }

    console.log('[GEN] ========== REQUEST END (success) ==========');
    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: publicUrl,
        recordId,
        pictureId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GEN] ========== REQUEST END (CRASH) ==========');
    console.error('[GEN] Edge function crash:', message);
    console.error('[GEN] Stack:', error instanceof Error ? error.stack : 'N/A');
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
