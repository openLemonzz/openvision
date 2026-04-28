import express from 'express';
import cors from 'cors';
import type { Response } from 'express';
import { randomInt } from 'node:crypto';
import { config } from './config.js';
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
  generationRequestTimeoutMs?: number;
  imageDownloadTimeoutMs?: number;
  imageDownloadRetryCount?: number;
  imageDownloadRetryBaseDelayMs?: number;
}

export const DEFAULT_GENERATION_REQUEST_TIMEOUT_MS = 20 * 60 * 1000;
const OPENAI_SAFE_IMAGE_SIZE = '1024x1024';
const OPENAI_IMAGE_SIZE_BY_ASPECT_RATIO: Record<string, string> = {
  '1:1': OPENAI_SAFE_IMAGE_SIZE,
  '16:9': '1536x1024',
  '3:4': '1024x1536',
  '9:16': '1024x1536',
};
const STABILITY_IMAGE_SIZE_BY_ASPECT_RATIO: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1024x576',
  '3:4': '768x1024',
  '9:16': '576x1024',
};

type ModelTestState = 'running' | 'completed' | 'failed';

type ModelTestDiagnostics = {
  endpoint: string;
  body: unknown;
};

type ModelTestProviderResponse = {
  status?: number;
  body?: string | null;
};

type ModelTestJobResult = {
  ok: boolean;
  state: ModelTestState;
  jobId: string;
  message: string;
  status?: number;
  details?: string | null;
  imageUrl?: string | null;
  request?: ModelTestDiagnostics;
  response?: ModelTestProviderResponse;
};

type ModelTestJobRecord = ModelTestJobResult & {
  modelId: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
};

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
    isShared: Boolean(row.is_shared),
    shareCode: (row.share_code as string | null) ?? null,
    userId: String(row.user_id),
  };
}

function generateShareCode() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[randomInt(chars.length)];
  }
  return result;
}

function generateBusinessCode(prefix: 'gen' | 'img' | 'job') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type ParsedImageDataUrl = {
  contentType: string;
  extension: 'png' | 'jpg' | 'webp';
  buffer: Uint8Array;
};

function parseImageDataUrl(value: string): ParsedImageDataUrl | null {
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const rawContentType = match[1].toLowerCase();
  const contentType = rawContentType === 'image/jpg' ? 'image/jpeg' : rawContentType;
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png';
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length === 0) {
    return null;
  }

  return {
    contentType,
    extension,
    buffer: new Uint8Array(buffer),
  };
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

function resolveImageEditApiEndpoint(apiEndpoint: string) {
  try {
    const parsedUrl = new URL(apiEndpoint);
    if (parsedUrl.pathname.endsWith('/images/generations')) {
      parsedUrl.pathname = parsedUrl.pathname.replace(/\/images\/generations$/, '/images/edits');
      return parsedUrl.toString();
    }
  } catch {
    // Fall through to string replacement fallback.
  }

  return apiEndpoint.replace(/\/images\/generations(?=\/?$)/, '/images/edits');
}

function resolveOpenAIImageSize(aspectRatio: string) {
  return OPENAI_IMAGE_SIZE_BY_ASPECT_RATIO[aspectRatio] || OPENAI_SAFE_IMAGE_SIZE;
}

function resolveStabilityImageSize(aspectRatio: string) {
  return STABILITY_IMAGE_SIZE_BY_ASPECT_RATIO[aspectRatio] || STABILITY_IMAGE_SIZE_BY_ASPECT_RATIO['1:1'];
}

function parseImageSize(size: unknown) {
  const value = typeof size === 'string' && /^\d+x\d+$/.test(size.trim())
    ? size.trim()
    : '1024x1024';
  const [width, height] = value.split('x').map(Number);

  return { value, width, height };
}

function buildModelAvailabilityRequest(model: Record<string, unknown>, prompt = 'availability test') {
  const protocol = String(model.protocol || 'openai');
  const upstreamModelId = String(model.request_model_id || model.id);
  const size = parseImageSize(model.default_size);

  if (protocol === 'stability') {
    return {
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      steps: 30,
      width: size.width,
      height: size.height,
      samples: 1,
    };
  }

  return {
    model: upstreamModelId,
    prompt,
    n: 1,
    size: size.value,
  };
}

function sharesOrigin(baseUrl: string, candidateUrl: string) {
  try {
    return new URL(candidateUrl, baseUrl).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableFetchError(error: unknown) {
  return isAbortError(error) || error instanceof TypeError;
}

function sleep(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  timeoutMs: number,
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetchImpl(input, init);
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function fetchWithRetry(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  timeoutMs: number,
  retryCount: number,
  baseDelayMs: number,
) {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetchWithTimeout(fetchImpl, input, init, timeoutMs);

      if (attempt >= retryCount || !isRetryableHttpStatus(response.status)) {
        return response;
      }

      try {
        await response.arrayBuffer();
      } catch {
        // Ignore body consumption errors for throwaway retry responses.
      }
    } catch (error) {
      if (attempt >= retryCount || !isRetryableFetchError(error)) {
        throw error;
      }
    }

    await sleep(baseDelayMs * (2 ** attempt));
    attempt += 1;
  }
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
  generationRequestTimeoutMs = DEFAULT_GENERATION_REQUEST_TIMEOUT_MS,
  imageDownloadTimeoutMs = 15000,
  imageDownloadRetryCount = 1,
  imageDownloadRetryBaseDelayMs = 250,
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
  app.use(express.json({ limit: '18mb' }));

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
      `select id, request_model_id, name, provider, api_endpoint, api_key_ciphertext, enabled, max_tokens,
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

  async function resolveGeneratedImageBuffer(
    payload: {
      data?: Array<{ url?: string; b64_json?: string }>;
      url?: string;
      image_url?: string;
      imageUrl?: string;
    },
    modelApiEndpoint: string,
    apiKey: string,
  ) {
    if (payload.data?.[0]?.b64_json) {
      return Uint8Array.from(Buffer.from(payload.data[0].b64_json, 'base64'));
    }

    const imageUrl =
      payload.data?.[0]?.url ||
      payload.url ||
      payload.image_url ||
      payload.imageUrl ||
      null;

    if (!imageUrl) {
      return null;
    }

    const resolvedImageUrl = resolveRelativeUrl(modelApiEndpoint, imageUrl);
    const imageResponse = await fetchWithRetry(
      fetchImpl,
      resolvedImageUrl,
      sharesOrigin(modelApiEndpoint, resolvedImageUrl)
        ? {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        : {},
      imageDownloadTimeoutMs,
      imageDownloadRetryCount,
      imageDownloadRetryBaseDelayMs,
    );

    if (!imageResponse.ok) {
      const responseBody = truncateDiagnosticText(await imageResponse.text());
      throw new Error(
        responseBody
          ? `Generated image download failed with status ${imageResponse.status}: ${responseBody}`
          : `Generated image download failed with status ${imageResponse.status}`
      );
    }

    return new Uint8Array(await imageResponse.arrayBuffer());
  }

  async function uploadGeneratedImage(userId: string, imageBuffer: Uint8Array) {
    const storageClient = await getStorageClient();
    if (!storageClient) {
      throw new Error(`Missing server config: ${missingConfig.join(', ')}`);
    }

    const pictureId = generateBusinessCode('img');
    const filePath = `${userId}/${pictureId}.png`;
    const { error: uploadError } = await storageClient.storage
      .from('images')
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${truncateDiagnosticText(uploadError) ?? 'unknown error'}`);
    }

    const { data: urlData } = storageClient.storage.from('images').getPublicUrl(filePath);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return {
      pictureId,
      publicUrl: urlData.publicUrl,
      expiresAt,
    };
  }

  async function uploadReferenceImage(userId: string, dataUrl: string) {
    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) {
      throw new Error('Invalid reference image data');
    }

    const storageClient = await getStorageClient();
    if (!storageClient) {
      throw new Error(`Missing server config: ${missingConfig.join(', ')}`);
    }

    const referenceId = generateBusinessCode('img');
    const filePath = `${userId}/references/${referenceId}.${parsed.extension}`;
    const { error: uploadError } = await storageClient.storage
      .from('images')
      .upload(filePath, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${truncateDiagnosticText(uploadError) ?? 'unknown error'}`);
    }

    const { data: urlData } = storageClient.storage.from('images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }

  const modelTestJobs = new Map<string, ModelTestJobRecord>();

  function pruneModelTestJobs() {
    const expiresBefore = Date.now() - 60 * 60 * 1000;
    for (const [jobId, job] of modelTestJobs.entries()) {
      if (job.updatedAt < expiresBefore) {
        modelTestJobs.delete(jobId);
      }
    }
  }

  function updateModelTestJob(jobId: string, updates: Omit<Partial<ModelTestJobResult>, 'jobId'>) {
    const currentJob = modelTestJobs.get(jobId);
    if (!currentJob) {
      return;
    }

    modelTestJobs.set(jobId, {
      ...currentJob,
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async function runModelTestJob(jobId: string, adminUserId: string, testModel: Record<string, unknown>, apiKey: string) {
    const testModelId = String(testModel.id);
    const testPrompt = `${testModelId} availability test image`;
    const testModelForRequest = {
      ...testModel,
      default_size: OPENAI_SAFE_IMAGE_SIZE,
    };
    const requestBody = buildModelAvailabilityRequest(testModelForRequest, testPrompt);
    const requestDiagnostics: ModelTestDiagnostics = {
      endpoint: String(testModel.api_endpoint),
      body: requestBody,
    };
    let generationId: string | null = null;

    async function failJob(
      message: string,
      details: string | null,
      status?: number,
      response?: ModelTestProviderResponse,
      persistedDetails = details,
    ) {
      if (generationId) {
        await markGenerationFailed(generationId, adminUserId, message, persistedDetails);
      }

      updateModelTestJob(jobId, {
        ok: false,
        state: 'failed',
        message,
        status,
        details,
        request: requestDiagnostics,
        response,
      });
    }

    try {
      const generationCode = generateBusinessCode('gen');
      const { rows: inserted } = await query!(
        `insert into public.generations
           (user_id, prompt, aspect_ratio, style_strength, engine, generation_code, status, picture_lifecycle)
         values
           ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
         returning id, generation_code`,
        [adminUserId, testPrompt, '1:1', 75, testModelId, generationCode]
      );

      generationId = String(inserted[0].id);

      await query!(
        `update public.generations
            set status = 'generating', picture_lifecycle = 'generating'
          where id = $1 and user_id = $2`,
        [generationId, adminUserId]
      );

      let apiResponse: globalThis.Response;
      try {
        apiResponse = await fetchWithTimeout(
          fetchImpl,
          requestDiagnostics.endpoint,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
          generationRequestTimeoutMs,
        );
      } catch (error) {
        if (isAbortError(error)) {
          await failJob(
            'Upstream request timed out',
            `Upstream request to provider timed out after ${generationRequestTimeoutMs}ms`,
          );
          return;
        }

        throw error;
      }

      const rawResponseBody = await apiResponse.text();
      const responseBody = truncateDiagnosticText(rawResponseBody);
      const responseDiagnostics: ModelTestProviderResponse = {
        status: apiResponse.status,
        body: responseBody,
      };

      if (!apiResponse.ok) {
        const errorMessage = `Upstream failed: ${apiResponse.status}`;
        const errorDetails = responseBody
          ? `Upstream failed with status ${apiResponse.status}: ${responseBody}`
          : `Upstream failed with status ${apiResponse.status}`;
        await failJob(errorMessage, responseBody, apiResponse.status, responseDiagnostics, errorDetails);
        return;
      }

      let payload: {
        data?: Array<{ url?: string; b64_json?: string }>;
        url?: string;
        image_url?: string;
        imageUrl?: string;
      };

      try {
        payload = rawResponseBody ? JSON.parse(rawResponseBody) as typeof payload : {};
      } catch {
        await failJob(
          'Invalid provider response',
          responseBody
            ? `Provider response was not valid JSON: ${responseBody}`
            : 'Provider response was not valid JSON',
          apiResponse.status,
          responseDiagnostics,
        );
        return;
      }

      let imageBuffer: Uint8Array | null = null;
      try {
        imageBuffer = await resolveGeneratedImageBuffer(payload, requestDiagnostics.endpoint, apiKey);
      } catch (error) {
        const errorMessage = isAbortError(error)
          ? 'Generated image download timed out'
          : 'Failed to download generated image';
        const errorDetails = isAbortError(error)
          ? `Generated image download timed out after ${imageDownloadTimeoutMs}ms`
          : error instanceof Error
          ? error.message
          : String(error);
        await failJob(errorMessage, errorDetails, apiResponse.status, responseDiagnostics);
        return;
      }

      if (!imageBuffer) {
        const errorMessage = 'No image returned from provider';
        const errorDetails = responseBody
          ? `Provider response did not contain an image URL or base64 payload: ${responseBody}`
          : 'Provider response did not contain an image URL or base64 payload';
        await failJob(errorMessage, errorDetails, apiResponse.status, responseDiagnostics);
        return;
      }

      let uploadedImage: Awaited<ReturnType<typeof uploadGeneratedImage>>;
      try {
        uploadedImage = await uploadGeneratedImage(adminUserId, imageBuffer);
      } catch (error) {
        const errorDetails = error instanceof Error ? error.message : String(error);
        await failJob('Failed to upload image', errorDetails, apiResponse.status, responseDiagnostics);
        return;
      }

      await query!(
        `update public.generations
            set status = 'completed',
                image_url = $3,
                picture_id = $4,
                picture_expires_at = $5,
                picture_lifecycle = 'active'
          where id = $1 and user_id = $2`,
        [generationId, adminUserId, uploadedImage.publicUrl, uploadedImage.pictureId, uploadedImage.expiresAt.toISOString()]
      );

      updateModelTestJob(jobId, {
        ok: true,
        state: 'completed',
        status: apiResponse.status,
        message: 'Model test succeeded',
        imageUrl: uploadedImage.publicUrl,
      });
    } catch (error) {
      const errorDetails = error instanceof Error ? error.message : String(error);
      await failJob('Model test crashed', errorDetails);
    }
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
      `select id, request_model_id, name, provider, api_endpoint, enabled, max_tokens, temperature,
              default_size, protocol,
              case when api_key_ciphertext is not null and api_key_ciphertext <> '' then true else false end as "hasApiKey"
         from public.model_configs
        order by created_at asc`
    );

    res.json(rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      requestModelId: row.request_model_id || row.id,
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
    const nextId = String(req.body.id || currentId).trim();
    const nextRequestModelId = String(req.body.requestModelId || nextId).trim() || nextId;
    const apiKeyCiphertext =
      req.body.apiKey?.trim()
        ? encryptSecret(req.body.apiKey.trim(), configCryptKey)
        : existing?.api_key_ciphertext ?? null;

    await query!(
      `insert into public.model_configs
         (id, request_model_id, name, provider, api_endpoint, api_key_ciphertext, enabled, max_tokens, temperature, default_size, protocol)
       values
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update
         set request_model_id = excluded.request_model_id,
             name = excluded.name,
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
        nextRequestModelId,
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

  app.delete('/api/models/:id', requireAdmin, asyncHandler(async (req, res) => {
    if (!ensureServerRuntime(res)) return;

    const { rowCount } = await query!(
      'delete from public.model_configs where id = $1',
      [String(req.params.id)]
    );

    if (!rowCount) {
      res.status(404).json({ error: 'Model config not found' });
      return;
    }

    res.status(204).end();
  }));

  app.post('/api/models/:id/test', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;

    const currentId = String(req.params.id);
    const existing = await loadModelConfig(currentId);
    const body = typeof req.body === 'object' && req.body !== null
      ? req.body as Record<string, unknown>
      : {};
    const hasBodyConfig = Boolean(
      body.id ||
      body.requestModelId ||
      body.apiEndpoint ||
      body.defaultSize ||
      body.protocol
    );

    if (!existing && !hasBodyConfig) {
      res.status(404).json({ error: 'Model config not found' });
      return;
    }

    const testModel: Record<string, unknown> = {
      id: String(body.id || existing?.id || currentId).trim() || currentId,
      request_model_id: String(
        body.requestModelId ||
        existing?.request_model_id ||
        body.id ||
        existing?.id ||
        currentId
      ).trim(),
      api_endpoint: String(body.apiEndpoint || existing?.api_endpoint || '').trim(),
      default_size: String(body.defaultSize || existing?.default_size || '1024x1024').trim(),
      protocol: String(body.protocol || existing?.protocol || 'openai').trim(),
    };

    if (!testModel.request_model_id) {
      res.status(400).json({ error: 'Request model ID is required' });
      return;
    }

    if (!testModel.api_endpoint) {
      res.status(400).json({ error: 'API endpoint is required' });
      return;
    }

    const apiKey =
      typeof body.apiKey === 'string' && body.apiKey.trim()
        ? body.apiKey.trim()
        : existing?.api_key_ciphertext
        ? decryptSecret(String(existing.api_key_ciphertext), configCryptKey)
        : '';

    if (!apiKey) {
      res.status(400).json({ error: 'Model API key is not configured' });
      return;
    }

    pruneModelTestJobs();
    const jobId = generateBusinessCode('job');
    const runningJob: ModelTestJobRecord = {
      ok: false,
      state: 'running',
      jobId,
      modelId: String(testModel.id),
      ownerId: req.authUser!.id,
      message: 'Model test started',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    modelTestJobs.set(jobId, runningJob);
    setTimeout(() => {
      void runModelTestJob(jobId, req.authUser!.id, testModel, apiKey);
    }, 0);

    res.status(202).json({
      ok: runningJob.ok,
      state: runningJob.state,
      jobId: runningJob.jobId,
      message: runningJob.message,
    });
  }));

  app.get('/api/models/:id/test/:jobId', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;

    const job = modelTestJobs.get(String(req.params.jobId));
    if (!job || job.modelId !== String(req.params.id) || job.ownerId !== req.authUser!.id) {
      res.status(404).json({ error: 'Model test job not found' });
      return;
    }

    res.json({
      ok: job.ok,
      state: job.state,
      jobId: job.jobId,
      status: job.status,
      message: job.message,
      details: job.details,
      imageUrl: job.imageUrl,
      request: job.request,
      response: job.response,
    });
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

  app.post('/api/my/generations/:id/share', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;

    // First try to just set it to shared, generating a new code if it doesn't have one
    const shareCode = generateShareCode();

    const { rows, rowCount } = await query!(
      `update public.generations
          set is_shared = true,
              share_code = coalesce(share_code, $3)
        where id = $1 and user_id = $2
      returning id, is_shared, share_code`,
      [req.params.id, req.authUser!.id, shareCode]
    );

    if (!rowCount) {
      res.status(404).json({ error: 'Generation not found' });
      return;
    }

    res.json({
      id: rows[0].id,
      isShared: Boolean(rows[0].is_shared),
      shareCode: rows[0].share_code,
    });
  }));

  app.delete('/api/my/generations/:id/share', requireUser, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!ensureServerRuntime(res)) return;

    const { rows, rowCount } = await query!(
      `update public.generations
          set is_shared = false
        where id = $1 and user_id = $2
      returning id, is_shared, share_code`,
      [req.params.id, req.authUser!.id]
    );

    if (!rowCount) {
      res.status(404).json({ error: 'Generation not found' });
      return;
    }

    res.json({
      id: rows[0].id,
      isShared: Boolean(rows[0].is_shared),
      shareCode: rows[0].share_code,
    });
  }));

  app.get('/api/public/shares/:shareCode', asyncHandler(async (req: express.Request, res: express.Response) => {
    if (!ensureServerRuntime(res)) return;

    const { rows } = await query!(
      `select g.id, g.prompt, g.aspect_ratio, g.style_strength, g.engine, g.image_url, g.created_at, g.picture_expires_at, g.picture_lifecycle, g.status, p.invite_code as creator_invite_code
         from public.generations g
         left join public.profiles p on g.user_id = p.user_id
        where g.share_code = $1 and g.is_shared = true`,
      [req.params.shareCode]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Shared generation not found or is private' });
      return;
    }

    const row = rows[0];

    // Omit sensitive data like user_id, is_favorite, etc.
    res.json({
      id: String(row.id),
      prompt: String(row.prompt),
      aspectRatio: row.aspect_ratio,
      styleStrength: Number(row.style_strength),
      engine: String(row.engine),
      imageUrl: String(row.image_url ?? ''),
      createdAt: new Date(String(row.created_at)).getTime(),
      expiresAt: row.picture_expires_at ? new Date(String(row.picture_expires_at)).getTime() : null,
      lifecycle: (row.picture_lifecycle as string | null) ?? null,
      status: row.status,
      creatorInviteCode: row.creator_invite_code ? String(row.creator_invite_code) : null,
    });
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
    const rawReferenceImageUrl =
      typeof req.body.referenceImageUrl === 'string' && req.body.referenceImageUrl.trim()
        ? req.body.referenceImageUrl.trim()
        : null;
    const rawReferenceImageDataUrl =
      typeof req.body.referenceImageDataUrl === 'string' && req.body.referenceImageDataUrl.trim()
        ? req.body.referenceImageDataUrl.trim()
        : null;
    const referenceImageDataUrl = rawReferenceImageDataUrl ||
      (rawReferenceImageUrl?.startsWith('data:') ? rawReferenceImageUrl : null);
    const referenceImageUrl =
      rawReferenceImageUrl && !rawReferenceImageUrl.startsWith('data:')
        ? rawReferenceImageUrl
        : null;
    const hasReferenceImage = Boolean(referenceImageUrl || referenceImageDataUrl);
    const userId = req.authUser!.id;

    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    if (referenceImageDataUrl && !parseImageDataUrl(referenceImageDataUrl)) {
      res.status(400).json({ error: 'Invalid reference image data' });
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

    if (hasReferenceImage && model.protocol === 'stability') {
      res.status(400).json({ error: 'Selected model does not support reference image edits' });
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

      const upstreamModelId = String(model.request_model_id || model.id);
      let resolvedReferenceImageUrl = referenceImageUrl;

      if (referenceImageDataUrl) {
        try {
          resolvedReferenceImageUrl = await uploadReferenceImage(userId, referenceImageDataUrl);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await markGenerationFailed(generationId, userId, 'Failed to upload reference image', message);
          res.status(message === 'Invalid reference image data' ? 400 : 500).json({ error: message });
          return;
        }
      }

      const requestBody =
        resolvedReferenceImageUrl
          ? {
              model: upstreamModelId,
              prompt,
              n: 1,
              size: resolveOpenAIImageSize(aspectRatio),
              images: [{ image_url: resolvedReferenceImageUrl }],
            }
          : model.protocol === 'stability'
          ? (() => {
              const [width, height] = resolveStabilityImageSize(aspectRatio).split('x').map(Number);
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
              model: upstreamModelId,
              prompt,
              n: 1,
              size: resolveOpenAIImageSize(aspectRatio),
            };

      const apiKey = decryptSecret(String(model.api_key_ciphertext), configCryptKey);
      let apiResponse: globalThis.Response;

      try {
        apiResponse = await fetchWithTimeout(
          fetchImpl,
          resolvedReferenceImageUrl
            ? resolveImageEditApiEndpoint(String(model.api_endpoint))
            : String(model.api_endpoint),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
          generationRequestTimeoutMs,
        );
      } catch (error) {
        if (isAbortError(error)) {
          const errorMessage = 'Upstream request timed out';
          const errorDetails = `Upstream request to provider timed out after ${generationRequestTimeoutMs}ms`;
          await markGenerationFailed(generationId, userId, errorMessage, errorDetails);
          res.status(504).json({ error: errorMessage });
          return;
        }

        throw error;
      }

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
        const resolvedImageUrl = resolveRelativeUrl(String(model.api_endpoint), imageUrl);
        let imageResponse: globalThis.Response;

        try {
          imageResponse = await fetchWithRetry(
            fetchImpl,
            resolvedImageUrl,
            sharesOrigin(String(model.api_endpoint), resolvedImageUrl)
              ? {
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                  },
                }
              : {},
            imageDownloadTimeoutMs,
            imageDownloadRetryCount,
            imageDownloadRetryBaseDelayMs,
          );
        } catch (error) {
          if (isAbortError(error)) {
            const errorMessage = 'Generated image download timed out';
            const errorDetails = `Generated image download timed out after ${imageDownloadTimeoutMs}ms`;
            await markGenerationFailed(generationId, userId, errorMessage, errorDetails);
            res.status(504).json({ error: errorMessage });
            return;
          }

          throw error;
        }

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
    void _next;
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  });

  return app;
}
