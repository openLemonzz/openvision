import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

async function checkTable(
  supabase: ReturnType<typeof createClient>,
  table: 'generations' | 'invites'
) {
  const { error } = await supabase
    .from(table)
    .select('id', { head: true, count: 'exact' })
    .limit(1);

  return error ? `table:${table}` : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const missingResources: string[] = [];

  if (!supabaseUrl) {
    missingResources.push('env:SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    missingResources.push('env:SUPABASE_SERVICE_ROLE_KEY');
  }

  if (missingResources.length === 0) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const tableChecks = await Promise.all([
      checkTable(supabase, 'generations'),
      checkTable(supabase, 'invites'),
    ]);

    tableChecks.forEach((item) => {
      if (item) {
        missingResources.push(item);
      }
    });

    const { data: bucket, error: bucketError } = await supabase.storage.getBucket('images');
    if (bucketError || !bucket) {
      missingResources.push('bucket:images');
    } else if (!bucket.public) {
      missingResources.push('bucket:images(public=false)');
    }
  }

  const ready = missingResources.length === 0;

  return new Response(
    JSON.stringify({
      ready,
      missingResources,
      message: ready ? 'ready' : 'backend is not initialized',
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
});
