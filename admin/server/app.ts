import express from 'express';
import cors from 'cors';
import type { Response } from 'express';
import { config, missingServerConfig } from './config.js';
import { pool } from './db.js';
import { decryptSecret, encryptSecret } from './crypto.js';
import {
  createRequireAdmin,
  createRequireUser,
  getSupabaseAdminClient,
  resolveBearerAuthUser,
  type AuthenticatedRequest,
  type QueryFn,
  type ResolveAuthUser,
} from './auth.js';

export interface ServerDependencies {
  query?: QueryFn;
  fetch?: typeof fetch;
  resolveAuthUser?: ResolveAuthUser;
  getStorageClient?: typeof getSupabaseAdminClient;
  webOrigin?: string;
  port?: number;
  configCryptKey?: string;
  missingConfig?: string[];
}

function asyncHandler(
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>
): express.RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

function mapGenerationRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    generationCode: (row.generation_code as string | null) ?? null,
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

function generateBusinessCode(prefix: 'gen' | 'img') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapAdminGenerationRow(row: Record<string, unknown>) {
  return {
    ...mapGenerationRow(row),
    errorMessage: (row.error_message as string | null) ?? null,
    errorDetails: (row.error_details as string | null) ?? null,
  };
}

function resolveRelativeUrl(baseUrl: string, maybeRelative: string) {
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) {
    return maybeRelative;
  }

  const base = baseUrl.replace(/\/v1\/.*$/, '').replace(/\/+$/, '');
  return `${base}${maybeRelative.startsWith('/') ? '' : '/'}${maybeRelative}`;
}

function normalizePublicWebUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new Error('publicWebUrl must be an absolute http/https URL');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('publicWebUrl must be an absolute http/https URL');
  }

  return parsedUrl.origin;
}

function normalizeConcurrencyLimit(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error('concurrencyLimit must be an integer >= 1');
  }

  return Number(value);
}

function truncateDiagnosticText(value: unknown, maxLength = 4000) {
  const rawValue =
    typeof value === 'string'
      ? value
      : value == null
      ? null
      : String(value);

  if (rawValue == null) {
    return null;
  }

  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, maxLength)}…`;
}

export function createApp({
  query = pool ? async (sql, params) => pool.query(sql, params) : undefined,
  fetch: fetchImpl = fetch,
  resolveAuthUser = resolveBearerAuthUser,
  getStorageClient = getSupabaseAdminClient,
  webOrigin = config.webOrigin,
  port = config.port,
  configCryptKey = config.configCryptKey,
  missingConfig = [],
}: ServerDependencies = {}) {
  const app = express();
  const requireUser = createRequireUser(resolveAuthUser);
  const requireAdmin = createRequireAdmin(resolveAuthUser, query ?? null);
  const allowedOrigins = Array.from(new Set([
    webOrigin,
    webOrigin.replace('localhost', '127.0.0.1'),
    webOrigin.replace('127.0.0.1', 'localhost'),
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    'http://localhost:4174',
    'http://127.0.0.1:4174',
  ]));

  app.use(cors({
    origin: allowedOrigins,
  }));
  app.use(express.json({ limit: '4mb' }));

  function ensureServerRuntime(res: Response) {
    if (query && missingConfig.length === 0) {
      return true;
    }

    res.status(503).json({ error: `Missing server config: ${missingConfig.join(', ')}` });
    return false;
  }

  async function loadModelConfig(modelId: string) {
    if (!query) {
      return null;
    }

    const { rows } = await query(
      `select id, name, provider, api_endpoint, api_key_ciphertext, enabled, max_tokens,
              temperature, default_size, protocol
         from public.model_configs
        where id = $1
        limit 1`,
      [modelId]
    );

    return rows[0] ?? null;
  }

  async function loadAppSettings() {
    if (!query) {
      return null;
    }

    const { rows } = await query(
      `select public_web_url
         from public.app_settings
        where id = 'default'
        limit 1`
    );

    return rows[0] ?? null;
  }

  async function saveAppSettings(publicWebUrl: string | null) {
    if (!query) {
      return null;
    }

    const { rows } = await query(
      `insert into public.app_settings (id, public_web_url)
       values ($1, $2)
       on conflict (id) do update
         set public_web_url = excluded.public_web_url,
             updated_at = now()
       returning public_web_url`,
      ['default', publicWebUrl]
    );

    return rows[0] ?? null;
  }

  async function loadUserGenerationProfile(userId: string) {
    if (!query) {
      return {
        isDisabled: false,
        concurrencyLimit: 1,
      };
    }

    const { rows: profileRows } = await query(
      `select is_disabled, coalesce(concurrency_limit, 1)::int as concurrency_limit
         from public.profiles
        where user_id = $1
        limit 1`,
      [userId]
    );

    const isDisabled = Boolean(profileRows[0]?.is_disabled);
    const concurrencyLimit = Number(profileRows[0]?.concurrency_limit ?? 1);

    return { isDisabled, concurrencyLimit };
  }

  async function countUserActiveGenerations(userId: string) {
    if (!query) {
      return 0;
    }

    const { rows: activeGenerationRows } = await query(
      `select count(*)::int as active_generation_count
         from public.generations
        where user_id = $1
          and status in ('pending', 'generating')`,
      [userId]
    );

    return Number(activeGenerationRows[0]?.active_generation_count ?? 0);
  }

  async function markGenerationFailed(
    id: string,
    userId: string,
    errorMessage: string,
    errorDetails?: string | null,
  ) {
    if (!query) {
      return;
    }

    await query(
      `update public.generations
          set status = 'failed',
              picture_lifecycle = 'expired',
              error_message = $3,
              error_details = $4
        where id = $1 and user_id = $2`,
      [
        id,
        userId,
        truncateDiagnosticText(errorMessage, 300) ?? 'Generation failed',
        truncateDiagnosticText(errorDetails),
      ]
    );
  }

  async function loadWebMe(userId: string) {
    if (!query) {
      return null;
    }

    const { rows } = await query(
      `select
         u.id::text as id,
         u.email,
         coalesce(p.username, split_part(u.email, '@', 1), 'User') as username,
         p.invite_code,
         coalesce(ref.invite_count, 0)::int as invite_count,
         coalesce(p.is_disabled, false) as is_disabled,
         coalesce(p.concurrency_limit, 1)::int as concurrency_limit,
         case when ar.user_id is not null then true else false end as is_admin
       from auth.users u
       left join public.profiles p on p.user_id = u.id
       left join public.admin_roles ar on ar.user_id = u.id
       left join (
         select inviter_id, count(*)::int as invite_count
           from public.referrals
          where inviter_id = $2
          group by inviter_id
       ) ref on ref.inviter_id = u.id
      where u.id = $1
      limit 1`,
      [userId, userId]
    );

    return rows[0] ?? null;
  }

  async function ensureUserProfile(userId: string, email: string) {
    if (!query) {
      return;
    }

    await query(
      `insert into public.profiles (user_id, username, invite_code)
       values ($1, $2, public.generate_invite_code())
       on conflict (user_id) do nothing`,
      [userId, email.split('@')[0] || 'User']
    );
  }

  app.get('/api/health', asyncHandler(async (_req, res) => {
    if (!query) {
      res.status(503).json({ ok: false, missing: missingConfig });
      return;
    }

    try {
      await query('select 1');
      res.json({ ok: missingConfig.length === 0, missing: missingConfig });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(503).json({ ok: false, missing: missingConfig, error: message });
    }
  }));

  app.get('/api/me', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!query) {
      res.status(503).json({ error: `Missing server config: ${missingConfig.join(', ')}` });
      return;
    }

    let row = await loadWebMe(req.authUser!.id);
    if (!row || !row.invite_code) {
      await ensureUserProfile(req.authUser!.id, req.authUser!.email);
      row = await loadWebMe(req.authUser!.id);
    }

    if (!row) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    res.json({
      id: row.id,
      email: row.email,
      username: row.username,
      inviteCode: row.invite_code,
      inviteCount: Number(row.invite_count ?? 0),
      isDisabled: Boolean(row.is_disabled),
      isAdmin: Boolean(row.is_admin),
      concurrencyLimit: Number(row.concurrency_limit ?? 1),
    });
  }));

  app.get('/api/users', requireAdmin, asyncHandler(async (_req, res) => {
    if (!ensureServerRuntime(res)) return;
    const { rows } = await query!(
      `select
         u.id::text as id,
         coalesce(p.username, split_part(u.email, '@', 1), 'User') as username,
         u.email,
         case
           when coalesce(p.is_disabled, false) then 'banned'
           when u.confirmed_at is null then 'pending'
           else 'active'
         end as status,
         case when ar.user_id is not null then 'admin' else 'user' end as role,
         to_char(coalesce(p.created_at, u.created_at), 'YYYY-MM-DD') as "createdAt",
         coalesce(gen.generation_count, 0)::int as "generationCount",
         coalesce(ref.invite_count, 0)::int as "inviteCount",
         coalesce(p.concurrency_limit, 1)::int as "concurrencyLimit"
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
    await query!(
      'update public.profiles set is_disabled = $2 where user_id = $1',
      [req.params.id, nextDisabled]
    );

    res.status(204).end();
  }));

  app.patch('/api/users/:id/settings', requireAdmin, asyncHandler(async (req, res) => {
    if (!ensureServerRuntime(res)) return;

    try {
      const concurrencyLimit = normalizeConcurrencyLimit(req.body.concurrencyLimit);
      const { rows, rowCount } = await query!(
        `update public.profiles
            set concurrency_limit = $2
          where user_id = $1
        returning user_id, concurrency_limit`,
        [req.params.id, concurrencyLimit]
      );

      if (!rowCount) {
        res.status(404).json({ error: 'User profile not found' });
        return;
      }

      res.json({
        id: String(rows[0].user_id),
        concurrencyLimit: Number(rows[0].concurrency_limit ?? 1),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'concurrencyLimit must be an integer >= 1') {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  }));

  app.delete('/api/users/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;

    if (req.params.id === req.authUser?.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { rows } = await query!(
      'select id from auth.users where id = $1 limit 1',
      [req.params.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const invitesTable = await query!(
      `select to_regclass('public.invites') as has_invites`
    );

    if (invitesTable.rows[0]?.has_invites) {
      await query!(
        'delete from public.invites where inviter_id = $1 or invitee_id = $1',
        [req.params.id]
      );
    }

    await query!(
      'delete from auth.users where id = $1',
      [req.params.id]
    );

    res.status(204).end();
  }));

  app.get('/api/models', requireAdmin, asyncHandler(async (_req, res) => {
    if (!ensureServerRuntime(res)) return;
    const { rows } = await query!(
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
        ? encryptSecret(req.body.apiKey.trim(), configCryptKey)
        : existing?.api_key_ciphertext ?? null;

    await query!(
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
      await query!('delete from public.model_configs where id = $1', [currentId]);
    }

    res.status(204).end();
  }));

  app.get('/api/public/models', asyncHandler(async (_req, res) => {
    if (!ensureServerRuntime(res)) return;
    const { rows } = await query!(
      `select id, name, provider, enabled, max_tokens, temperature, default_size, protocol
         from public.model_configs
        where enabled = true
        order by created_at asc`
    );

    res.json(rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      provider: row.provider,
      enabled: Boolean(row.enabled),
      maxTokens: Number(row.max_tokens),
      temperature: Number(row.temperature),
      defaultSize: row.default_size,
      protocol: row.protocol,
    })));
  }));

  app.get('/api/settings/public', asyncHandler(async (_req, res) => {
    if (!ensureServerRuntime(res)) return;
    const settings = await loadAppSettings();

    res.json({
      publicWebUrl: (settings?.public_web_url as string | null) ?? null,
    });
  }));

  app.get('/api/settings', requireAdmin, asyncHandler(async (_req, res) => {
    if (!ensureServerRuntime(res)) return;
    const settings = await loadAppSettings();

    res.json({
      publicWebUrl: (settings?.public_web_url as string | null) ?? null,
    });
  }));

  app.put('/api/settings', requireAdmin, asyncHandler(async (req, res) => {
    if (!ensureServerRuntime(res)) return;

    try {
      const normalizedPublicWebUrl = normalizePublicWebUrl(req.body.publicWebUrl);
      const settings = await saveAppSettings(normalizedPublicWebUrl);

      res.json({
        publicWebUrl: (settings?.public_web_url as string | null) ?? null,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'publicWebUrl must be an absolute http/https URL') {
        res.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  }));

  app.get('/api/my/generations', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;
    const { rows } = await query!(
      `select *
         from public.generations
        where user_id = $1
        order by created_at desc
        limit 50`,
      [req.authUser!.id]
    );

    res.json(rows.map(mapGenerationRow));
  }));

  app.get('/api/my/generation-capacity', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;

    const profile = await loadUserGenerationProfile(req.authUser!.id);
    const activeGenerationCount = await countUserActiveGenerations(req.authUser!.id);
    const reason =
      profile.isDisabled
        ? 'user_disabled'
        : activeGenerationCount >= profile.concurrencyLimit
        ? 'concurrency_limit_reached'
        : null;

    res.json({
      concurrencyLimit: profile.concurrencyLimit,
      activeGenerationCount,
      canGenerate: reason === null,
      reason,
    });
  }));

  app.patch('/api/my/generations/:id/favorite', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;
    const nextFavorite = Boolean(req.body.isFavorite);
    const { rows, rowCount } = await query!(
      `update public.generations
          set is_favorite = $3
        where id = $1 and user_id = $2
      returning id, is_favorite`,
      [req.params.id, req.authUser!.id, nextFavorite]
    );

    if (!rowCount) {
      res.status(404).json({ error: 'Generation not found' });
      return;
    }

    res.json({
      id: rows[0].id,
      isFavorite: Boolean(rows[0].is_favorite),
    });
  }));

  app.delete('/api/my/generations/:id', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;
    const { rowCount } = await query!(
      'delete from public.generations where id = $1 and user_id = $2',
      [req.params.id, req.authUser!.id]
    );

    if (!rowCount) {
      res.status(404).json({ error: 'Generation not found' });
      return;
    }

    res.status(204).end();
  }));

  app.get('/api/generations', requireAdmin, asyncHandler(async (_req, res) => {
    if (!ensureServerRuntime(res)) return;
    const { rows } = await query!(
      `select *
         from public.generations
        order by created_at desc
        limit 200`
    );

    res.json(rows.map(mapAdminGenerationRow));
  }));

  app.delete('/api/generations/:id', requireAdmin, asyncHandler(async (req, res) => {
    if (!ensureServerRuntime(res)) return;
    await query!('delete from public.generations where id = $1', [req.params.id]);
    res.status(204).end();
  }));

  app.post('/api/generate', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;
    const prompt = String(req.body.prompt || '').trim();
    const modelId = String(req.body.modelId || req.body.engine || '');
    const aspectRatio = String(req.body.aspectRatio || '1:1');
    const styleStrength = Number(req.body.styleStrength || 75);
    const userId = req.authUser!.id;

    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const profile = await loadUserGenerationProfile(userId);

    if (profile.isDisabled) {
      res.status(403).json({ error: 'User is disabled' });
      return;
    }

    const activeGenerationCount = await countUserActiveGenerations(userId);
    if (activeGenerationCount >= profile.concurrencyLimit) {
      res.status(409).json({ error: 'Concurrency limit reached' });
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

      const generationCode = generateBusinessCode('gen');

      const { rows: inserted } = await query!(
        `insert into public.generations
         (user_id, prompt, aspect_ratio, style_strength, engine, generation_code, status, picture_lifecycle)
       values
         ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
       returning id, generation_code`,
      [userId, prompt, aspectRatio, styleStrength, modelId, generationCode]
      );

    const generationId = inserted[0].id as string;
    const persistedGenerationCode = String(inserted[0].generation_code ?? generationCode);

    try {
      await query!(
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

      const apiKey = decryptSecret(String(model.api_key_ciphertext), configCryptKey);
      const apiResponse = await fetchImpl(String(model.api_endpoint), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!apiResponse.ok) {
        const errorMessage = `Upstream failed: ${apiResponse.status}`;
        const responseBody = truncateDiagnosticText(await apiResponse.text());
        const errorDetails = responseBody
          ? `Upstream failed with status ${apiResponse.status}: ${responseBody}`
          : `Upstream failed with status ${apiResponse.status}`;
        await markGenerationFailed(generationId, userId, errorMessage, errorDetails);
        res.status(502).json({ error: errorMessage });
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
        const imageResponse = await fetchImpl(resolveRelativeUrl(String(model.api_endpoint), imageUrl));
        if (!imageResponse.ok) {
          const responseBody = truncateDiagnosticText(await imageResponse.text());
          await markGenerationFailed(
            generationId,
            userId,
            'Failed to download generated image',
            responseBody
              ? `Generated image download failed with status ${imageResponse.status}: ${responseBody}`
              : `Generated image download failed with status ${imageResponse.status}`
          );
          res.status(502).json({ error: 'Failed to download generated image' });
          return;
        }
        imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
      }

      if (!imageBuffer) {
        await markGenerationFailed(
          generationId,
          userId,
          'No image returned from provider',
          'Provider response did not contain an image URL or base64 payload'
        );
        res.status(502).json({ error: 'No image returned from provider' });
        return;
      }

      const storageClient = await getStorageClient();
      if (!storageClient) {
        const errorMessage = 'Storage client unavailable';
        const errorDetails = `Missing server config: ${missingConfig.join(', ')}`;
        await markGenerationFailed(generationId, userId, errorMessage, errorDetails);
        res.status(503).json({ error: errorDetails });
        return;
      }

      const pictureId = generateBusinessCode('img');
      const filePath = `${userId}/${pictureId}.png`;
      const { error: uploadError } = await storageClient!.storage
        .from('images')
        .upload(filePath, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        await markGenerationFailed(
          generationId,
          userId,
          'Failed to upload image',
          `Storage upload failed: ${truncateDiagnosticText(uploadError) ?? 'unknown error'}`
        );
        res.status(500).json({ error: 'Failed to upload image' });
        return;
      }

      const { data: urlData } = storageClient!.storage.from('images').getPublicUrl(filePath);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await query!(
        `update public.generations
            set status = 'completed',
                image_url = $3,
                picture_id = $4,
                picture_expires_at = $5,
                picture_lifecycle = 'active'
          where id = $1 and user_id = $2`,
        [generationId, userId, urlData.publicUrl, pictureId, expiresAt.toISOString()]
      );

      res.json({ id: generationId, generationCode: persistedGenerationCode });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markGenerationFailed(generationId, userId, 'Generation pipeline crashed', message);
      res.status(500).json({ error: message });
    }
  }));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  });

  return app;
}
