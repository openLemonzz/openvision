import { apiBaseUrl, supabase } from './supabase';

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string | null
) {
  let resolvedAccessToken = accessToken;
  if (typeof resolvedAccessToken === 'undefined') {
    const { data } = await supabase.auth.getSession();
    resolvedAccessToken = data.session?.access_token ?? null;
  }

  const headers = new Headers(init.headers);

  headers.set('Content-Type', 'application/json');

  if (resolvedAccessToken) {
    headers.set('Authorization', `Bearer ${resolvedAccessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
