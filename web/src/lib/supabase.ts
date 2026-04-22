import { createClient } from '@supabase/supabase-js';
import { resolveRuntimeConfig } from './runtime-config';

export const appRuntimeConfig = resolveRuntimeConfig({
  envConfig: {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_ADMIN_API_URL: import.meta.env.VITE_ADMIN_API_URL,
  },
  runtimeConfig: typeof window !== 'undefined' ? window.__APP_CONFIG__ : {},
});

export const supabaseUrl = appRuntimeConfig.supabaseUrl;
export const supabaseAnonKey = appRuntimeConfig.supabaseAnonKey;
export const adminApiUrl = appRuntimeConfig.adminApiUrl;
export const isDockerRuntime = appRuntimeConfig.runtime === 'docker';
const isConfigured = appRuntimeConfig.supabaseEnabled;
const noOpLock = async <T>(_name: string, _timeout: number, fn: () => Promise<T>) => fn();

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        lock: noOpLock,
      },
    })
  : createClient('http://placeholder.invalid', 'placeholder', {
      auth: {
        lock: noOpLock,
      },
    });

export const supabaseEnabled = isConfigured;
