export interface BrowserRuntimeConfig {
  runtime?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_ADMIN_API_URL?: string;
  VITE_ADMIN_APP_URL?: string;
}

export interface ResolveRuntimeConfigOptions {
  envConfig?: BrowserRuntimeConfig;
  runtimeConfig?: BrowserRuntimeConfig;
}

export type RuntimeGate =
  | { kind: 'config-missing'; missingKeys: string[] }
  | { kind: 'check-required'; missingKeys: [] }
  | { kind: 'pass-through'; missingKeys: [] };

export interface ResolvedRuntimeConfig {
  runtime: 'docker' | 'local';
  supabaseUrl: string;
  supabaseAnonKey: string;
  adminApiUrl: string;
  supabaseEnabled: boolean;
  gate: RuntimeGate;
}

export interface HealthPayload {
  ok: boolean;
  missing: string[];
  error?: string;
}

export interface HealthProbeResult {
  reachable: boolean;
  status: number;
  payload: HealthPayload | null;
}

export type InitializationReadiness =
  | { kind: 'ready'; message: string; missingResources: [] }
  | { kind: 'network-error'; message: string; missingResources: [] }
  | { kind: 'backend-uninitialized'; message: string; missingResources: string[] };

const REQUIRED_RUNTIME_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_ADMIN_API_URL',
] as const;

function normalizeValue(value: string | undefined) {
  return value?.trim() ?? '';
}

export function resolveRuntimeConfig({
  envConfig = {},
  runtimeConfig = {},
}: ResolveRuntimeConfigOptions = {}): ResolvedRuntimeConfig {
  const runtime = runtimeConfig.runtime === 'docker' ? 'docker' : 'local';
  const supabaseUrl = normalizeValue(
    runtimeConfig.VITE_SUPABASE_URL || envConfig.VITE_SUPABASE_URL
  );
  const supabaseAnonKey = normalizeValue(
    runtimeConfig.VITE_SUPABASE_ANON_KEY || envConfig.VITE_SUPABASE_ANON_KEY
  );
  const adminApiUrl = normalizeValue(
    runtimeConfig.VITE_ADMIN_API_URL || envConfig.VITE_ADMIN_API_URL
  );
  const supabaseEnabled = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
  const missingKeys = REQUIRED_RUNTIME_KEYS.filter((key) =>
    normalizeValue(runtimeConfig[key] || envConfig[key]).length === 0
  );

  if (missingKeys.length > 0) {
    return {
      runtime,
      supabaseUrl,
      supabaseAnonKey,
      adminApiUrl,
      supabaseEnabled,
      gate: { kind: 'config-missing', missingKeys: [...missingKeys] },
    };
  }

  if (runtime === 'docker') {
    return {
      runtime,
      supabaseUrl,
      supabaseAnonKey,
      adminApiUrl,
      supabaseEnabled,
      gate: { kind: 'check-required', missingKeys: [] },
    };
  }

  return {
    runtime,
    supabaseUrl,
    supabaseAnonKey,
    adminApiUrl,
    supabaseEnabled,
    gate: { kind: 'pass-through', missingKeys: [] },
  };
}

export function evaluateInitializationReadiness({
  health,
}: {
  health: HealthProbeResult;
}): InitializationReadiness {
  if (!health.reachable) {
    return {
      kind: 'network-error',
      message: 'Admin health endpoint is unreachable',
      missingResources: [],
    };
  }

  if (!health.payload) {
    return {
      kind: 'backend-uninitialized',
      message: `Health endpoint returned HTTP ${health.status}`,
      missingResources: [],
    };
  }

  if (health.payload.ok) {
    return {
      kind: 'ready',
      message: 'Admin backend is ready.',
      missingResources: [],
    };
  }

  return {
    kind: 'backend-uninitialized',
    message: health.payload.error || 'Admin backend is not ready.',
    missingResources: health.payload.missing,
  };
}

declare global {
  interface Window {
    __APP_CONFIG__?: BrowserRuntimeConfig;
  }
}
