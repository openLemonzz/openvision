export interface AdminBrowserRuntimeConfig {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_API_BASE_URL?: string;
}

export function getAdminRuntimeConfig(): Required<AdminBrowserRuntimeConfig> {
  return {
    VITE_SUPABASE_URL:
      window.__ADMIN_CONFIG__?.VITE_SUPABASE_URL ||
      import.meta.env.VITE_SUPABASE_URL ||
      '',
    VITE_SUPABASE_ANON_KEY:
      window.__ADMIN_CONFIG__?.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      '',
    VITE_API_BASE_URL:
      window.__ADMIN_CONFIG__?.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      '/api',
  };
}

declare global {
  interface Window {
    __ADMIN_CONFIG__?: AdminBrowserRuntimeConfig;
  }
}
