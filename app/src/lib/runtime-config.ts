export interface BrowserRuntimeConfig {
  runtime?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
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
  supabaseEnabled: boolean;
  gate: RuntimeGate;
}

export interface HealthPayload {
  ready: boolean;
  missingResources: string[];
  message: string;
}

export interface HealthProbeResult {
  reachable: boolean;
  status: number;
  payload: HealthPayload | null;
}

export interface FunctionProbeResult {
  name: string;
  status: number;
}

export type InitializationReadiness =
  | { kind: 'ready'; message: string; missingResources: []; missingFunctions: [] }
  | { kind: 'network-error'; message: string; missingResources: []; missingFunctions: [] }
  | { kind: 'functions-missing'; message: string; missingFunctions: string[]; missingResources: [] }
  | { kind: 'backend-uninitialized'; message: string; missingResources: string[]; missingFunctions: [] };

const REQUIRED_RUNTIME_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
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
  const supabaseEnabled = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
  const missingKeys = REQUIRED_RUNTIME_KEYS.filter((key) =>
    normalizeValue(runtimeConfig[key] || envConfig[key]).length === 0
  );

  if (missingKeys.length > 0) {
    return {
      runtime,
      supabaseUrl,
      supabaseAnonKey,
      supabaseEnabled,
      gate: { kind: 'config-missing', missingKeys: [...missingKeys] },
    };
  }

  if (runtime === 'docker') {
    return {
      runtime,
      supabaseUrl,
      supabaseAnonKey,
      supabaseEnabled,
      gate: { kind: 'check-required', missingKeys: [] },
    };
  }

  return {
    runtime,
    supabaseUrl,
    supabaseAnonKey,
    supabaseEnabled,
    gate: { kind: 'pass-through', missingKeys: [] },
  };
}

export function evaluateInitializationReadiness({
  health,
  functionProbes,
}: {
  health: HealthProbeResult;
  functionProbes: FunctionProbeResult[];
}): InitializationReadiness {
  if (!health.reachable) {
    return {
      kind: 'network-error',
      message: 'Supabase health endpoint is unreachable',
      missingResources: [],
      missingFunctions: [],
    };
  }

  const missingFunctions = functionProbes
    .filter((probe) => probe.status === 404)
    .map((probe) => probe.name);
  const unreachableFunctions = functionProbes
    .filter((probe) => probe.status === 0)
    .map((probe) => probe.name);

  if (unreachableFunctions.length > 0) {
    return {
      kind: 'network-error',
      message: `Unable to reach function probes: ${unreachableFunctions.join(', ')}`,
      missingResources: [],
      missingFunctions: [],
    };
  }

  if (health.status === 404) {
    missingFunctions.unshift('health');
  }

  if (missingFunctions.length > 0) {
    return {
      kind: 'functions-missing',
      message: 'Required edge functions are not deployed yet',
      missingFunctions,
      missingResources: [],
    };
  }

  if (!health.payload) {
    return {
      kind: 'backend-uninitialized',
      message: `Health endpoint returned HTTP ${health.status}`,
      missingResources: [],
      missingFunctions: [],
    };
  }

  if (health.payload.ready) {
    return {
      kind: 'ready',
      message: health.payload.message,
      missingResources: [],
      missingFunctions: [],
    };
  }

  return {
    kind: 'backend-uninitialized',
    message: health.payload.message,
    missingResources: health.payload.missingResources,
    missingFunctions: [],
  };
}

declare global {
  interface Window {
    __APP_CONFIG__?: BrowserRuntimeConfig;
  }
}
