import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, missingServerConfig } from './config.js';
import { pool } from './db.js';
import { decryptSecret, encryptSecret } from './crypto.js';
import { requireAdmin, requireUser, supabaseAdmin, type AuthenticatedRequest } from './auth.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../client');

app.use(cors({
  origin: [config.webOrigin, `http://localhost:${config.port}`, 'http://localhost:4174'],
}));
app.use(express.json({ limit: '4mb' }));

function asyncHandler(
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>
): express.RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

function hasServerRuntime() {
  return Boolean(pool && supabaseAdmin && missingServerConfig.length === 0);
}

function ensureServerRuntime(res: express.Response) {
  if (hasServerRuntime()) {
    return true;
  }

  res.status(503).json({ error: `Missing server config: ${missingServerConfig.join(', ')}` });
  return false;
}

app.get('/env.js', (_req, res) => {
  res.type('application/javascript');
  res.send(
    `window.__ADMIN_CONFIG__ = ${JSON.stringify({
      VITE_SUPABASE_URL: config.supabaseUrl,
      VITE_SUPABASE_ANON_KEY: config.supabaseAnonKey,
      VITE_API_BASE_URL: '/api',
    })};`
  );
});

function mapGenerationRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    pictureId: (row.picture_id as string | null) ?? null,
    prompt: String(row.prompt),
    aspectRatio: row.aspect_ratio as '1:1' | '16:9' | '3:4' | '9:16',
    styleStrength: Number(row.style_strength),
    engine: String(row.engine),
    imageUrl: String(row.image_url ?? ''),
    createdAt: new Date(String(row.created_at)).getTime(),
    expiresAt: row.picture_expires_at ? new Date(String(row.picture_expires_at)).getTime() : null,
    lifecycle: (row.picture_lifecycle as string | null) ?? null,
    status: row.status as 'pending' | 'generating' | 'completed' | 'failed',
    isFavorite: Boolean(row.is_favorite),
    userId: String(row.user_id),
  };
}

function resolveRelativeUrl(baseUrl: string, maybeRelative: string) {
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) {
    return maybeRelative;
  }

  const base = baseUrl.replace(/\/v1\/.*$/, '').replace(/\/+$/, '');
  return `${base}${maybeRelative.startsWith('/') ? '' : '/'}${maybeRelative}`;
}

async function loadModelConfig(modelId: string) {
  const { rows } = await pool.query(
    `select id, name, provider, api_endpoint, api_key_ciphertext, enabled, max_tokens,
            temperature, default_size, protocol
       from public.model_configs
      where id = $1
      limit 1`,
    [modelId]
  );

  return rows[0] ?? null;
}

async function markGenerationFailed(id: string, userId: string) {
  await pool.query(
    `update public.generations
        set status = 'failed', picture_lifecycle = 'expired'
      where id = $1 and user_id = $2`,
    [id, userId]
  );
}

app.get('/api/health', asyncHandler(async (_req, res) => {
  if (!pool) {
    res.status(503).json({ ok: false, missing: missingServerConfig });
    return;
  }

  try {
    await pool.query('select 1');
    res.json({ ok: missingServerConfig.length === 0, missing: missingServerConfig });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ ok: false, missing: missingServerConfig, error: message });
  }
}));

app.get('/api/me', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { rowCount } = await pool.query(
    'select 1 from public.admin_roles where user_id = $1 limit 1',
    [req.authUser!.id]
  );

  res.json({
    id: req.authUser!.id,
    email: req.authUser!.email,
    isAdmin: rowCount > 0,
  });
}));

app.get('/api/users', requireAdmin, asyncHandler(async (_req, res) => {
  if (!ensureServerRuntime(res)) return;
  const { rows } = await pool.query(
    `select
       u.id::text as id,
       coalesce(p.username, split_part(u.email, '@', 1), 'User') as username,
       u.email,
       case when coalesce(p.is_disabled, false) then 'banned' else 'active' end as status,
       case when ar.user_id is not null then 'admin' else 'user' end as role,
       to_char(coalesce(p.created_at, u.created_at), 'YYYY-MM-DD') as "createdAt",
       coalesce(gen.generation_count, 0)::int as "generationCount",
       coalesce(ref.invite_count, 0)::int as "inviteCount"
     from auth.users u
     left join public.profiles p on p.user_id = u.id
     left join public.admin_roles ar on ar.user_id = u.id
     left join (
       select user_id, count(*) as generation_count
         from public.generations
        group by user_id
     ) gen on gen.user_id = u.id
     left join (
       select inviter_id, count(*) as invite_count
         from public.referrals
        group by inviter_id
     ) ref on ref.inviter_id = u.id
    order by coalesce(p.created_at, u.created_at) desc`
  );

  res.json(rows);
}));

app.patch('/api/users/:id/status', requireAdmin, asyncHandler(async (req, res) => {
  if (!ensureServerRuntime(res)) return;
  const nextDisabled = req.body.status === 'banned';
  await pool.query(
    'update public.profiles set is_disabled = $2 where user_id = $1',
    [req.params.id, nextDisabled]
  );

  res.status(204).end();
}));

app.get('/api/models', requireAdmin, asyncHandler(async (_req, res) => {
  if (!ensureServerRuntime(res)) return;
  const { rows } = await pool.query(
    `select id, name, provider, api_endpoint, enabled, max_tokens, temperature,
            default_size, protocol,
            case when api_key_ciphertext is not null and api_key_ciphertext <> '' then true else false end as "hasApiKey"
       from public.model_configs
      order by created_at asc`
  );

  res.json(rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    provider: row.provider,
    apiKey: '',
    apiEndpoint: row.api_endpoint,
    enabled: row.enabled,
    maxTokens: Number(row.max_tokens),
    temperature: Number(row.temperature),
    defaultSize: row.default_size,
    protocol: row.protocol,
    hasApiKey: row.hasApiKey,
  })));
}));

app.put('/api/models/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (!ensureServerRuntime(res)) return;
  const currentId = String(req.params.id);
  const existing = await loadModelConfig(currentId);
  const nextId = String(req.body.id || currentId);
  const apiKeyCiphertext =
    req.body.apiKey?.trim()
      ? encryptSecret(req.body.apiKey.trim(), config.configCryptKey)
      : existing?.api_key_ciphertext ?? null;

  await pool.query(
    `insert into public.model_configs
       (id, name, provider, api_endpoint, api_key_ciphertext, enabled, max_tokens, temperature, default_size, protocol)
     values
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (id) do update
       set name = excluded.name,
           provider = excluded.provider,
           api_endpoint = excluded.api_endpoint,
           api_key_ciphertext = excluded.api_key_ciphertext,
           enabled = excluded.enabled,
           max_tokens = excluded.max_tokens,
           temperature = excluded.temperature,
           default_size = excluded.default_size,
           protocol = excluded.protocol,
           updated_at = now()`,
    [
      nextId,
      req.body.name,
      req.body.provider,
      req.body.apiEndpoint,
      apiKeyCiphertext,
      req.body.enabled,
      req.body.maxTokens,
      req.body.temperature,
      req.body.defaultSize,
      req.body.protocol,
    ]
  );

  if (currentId !== nextId) {
    await pool.query('delete from public.model_configs where id = $1', [currentId]);
  }

  res.status(204).end();
}));

app.get('/api/public/models', asyncHandler(async (_req, res) => {
  if (!ensureServerRuntime(res)) return;
  const { rows } = await pool.query(
    `select id, name, provider, default_size, protocol
       from public.model_configs
      where enabled = true
      order by created_at asc`
  );

  res.json(rows);
}));

app.get('/api/generations', requireAdmin, asyncHandler(async (_req, res) => {
  if (!ensureServerRuntime(res)) return;
  const { rows } = await pool.query(
    `select *
       from public.generations
      order by created_at desc
      limit 200`
  );

  res.json(rows.map(mapGenerationRow));
}));

app.delete('/api/generations/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (!ensureServerRuntime(res)) return;
  await pool.query('delete from public.generations where id = $1', [req.params.id]);
  res.status(204).end();
}));

app.post('/api/generate', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!ensureServerRuntime(res)) return;
  const prompt = String(req.body.prompt || '').trim();
  const modelId = String(req.body.modelId || '');
  const aspectRatio = String(req.body.aspectRatio || '1:1');
  const styleStrength = Number(req.body.styleStrength || 75);
  const userId = req.authUser!.id;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  const { rows: profileRows } = await pool.query(
    'select is_disabled from public.profiles where user_id = $1 limit 1',
    [userId]
  );

  if (profileRows[0]?.is_disabled) {
    res.status(403).json({ error: 'User is disabled' });
    return;
  }

  const model = await loadModelConfig(modelId);
  if (!model || !model.enabled) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }

  if (!model.api_key_ciphertext) {
    res.status(500).json({ error: 'Model API key is not configured' });
    return;
  }

  const { rows: inserted } = await pool.query(
    `insert into public.generations
       (user_id, prompt, aspect_ratio, style_strength, engine, status, picture_lifecycle)
     values
       ($1, $2, $3, $4, $5, 'pending', 'pending')
     returning id`,
    [userId, prompt, aspectRatio, styleStrength, modelId]
  );

  const generationId = inserted[0].id as string;

  try {
    await pool.query(
      `update public.generations
          set status = 'generating', picture_lifecycle = 'generating'
        where id = $1 and user_id = $2`,
      [generationId, userId]
    );

    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1024x576',
      '3:4': '768x1024',
      '9:16': '576x1024',
    };

    const requestBody =
      model.protocol === 'stability'
        ? (() => {
            const [width, height] = (sizeMap[aspectRatio] || '1024x1024').split('x').map(Number);
            return {
              text_prompts: [{ text: prompt, weight: 1 }],
              cfg_scale: 7,
              steps: 30,
              width,
              height,
              samples: 1,
            };
          })()
        : {
            model: model.id,
            prompt,
            n: 1,
            size: sizeMap[aspectRatio] || '1024x1024',
          };

    const apiKey = decryptSecret(String(model.api_key_ciphertext), config.configCryptKey);
    const apiResponse = await fetch(String(model.api_endpoint), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      await markGenerationFailed(generationId, userId);
      res.status(502).json({ error: `Upstream failed: ${apiResponse.status}` });
      return;
    }

    const payload = await apiResponse.json() as {
      data?: Array<{ url?: string; b64_json?: string }>;
      url?: string;
      image_url?: string;
      imageUrl?: string;
    };

    let imageBuffer: Uint8Array | null = null;
    let imageUrl: string | null = null;

    if (payload.data?.[0]?.b64_json) {
      imageBuffer = Uint8Array.from(Buffer.from(payload.data[0].b64_json, 'base64'));
    } else {
      imageUrl =
        payload.data?.[0]?.url ||
        payload.url ||
        payload.image_url ||
        payload.imageUrl ||
        null;
    }

    if (imageUrl && !imageBuffer) {
      const imageResponse = await fetch(resolveRelativeUrl(String(model.api_endpoint), imageUrl));
      if (!imageResponse.ok) {
        await markGenerationFailed(generationId, userId);
        res.status(502).json({ error: 'Failed to download generated image' });
        return;
      }
      imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
    }

    if (!imageBuffer) {
      await markGenerationFailed(generationId, userId);
      res.status(502).json({ error: 'No image returned from provider' });
      return;
    }

    const pictureId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `${userId}/${pictureId}.png`;
    const { error: uploadError } = await supabaseAdmin!.storage
      .from('images')
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      await markGenerationFailed(generationId, userId);
      res.status(500).json({ error: 'Failed to upload image' });
      return;
    }

    const { data: urlData } = supabaseAdmin!.storage.from('images').getPublicUrl(filePath);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.query(
      `update public.generations
          set status = 'completed',
              image_url = $3,
              picture_id = $4,
              picture_expires_at = $5,
              picture_lifecycle = 'active'
        where id = $1 and user_id = $2`,
      [generationId, userId, urlData.publicUrl, pictureId, expiresAt.toISOString()]
    );

    res.json({ id: generationId });
  } catch (error) {
    await markGenerationFailed(generationId, userId);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
}));

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(config.port, () => {
  console.log(`admin service listening on :${config.port}`);
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(500).json({ error: message });
});
