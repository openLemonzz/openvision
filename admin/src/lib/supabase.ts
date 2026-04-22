import { createClient } from '@supabase/supabase-js';
import { getAdminRuntimeConfig } from './runtime-config';

const runtimeConfig = getAdminRuntimeConfig();
const noOpLock = async <T>(_name: string, _timeout: number, fn: () => Promise<T>) => fn();

export const supabase = createClient(
  runtimeConfig.VITE_SUPABASE_URL || 'http://placeholder.invalid',
  runtimeConfig.VITE_SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      lock: noOpLock,
    },
  }
);

export const apiBaseUrl = runtimeConfig.VITE_API_BASE_URL.replace(/\/$/, '');
