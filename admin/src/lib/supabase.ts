import { createClient } from '@supabase/supabase-js';
import { getAdminRuntimeConfig } from './runtime-config';

const runtimeConfig = getAdminRuntimeConfig();

export const supabase = createClient(
  runtimeConfig.VITE_SUPABASE_URL || 'http://placeholder.invalid',
  runtimeConfig.VITE_SUPABASE_ANON_KEY || 'placeholder'
);

export const apiBaseUrl = runtimeConfig.VITE_API_BASE_URL.replace(/\/$/, '');
