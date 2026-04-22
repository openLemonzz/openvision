const adminApiBaseUrl = (
  window.__APP_CONFIG__?.VITE_ADMIN_API_URL ||
  import.meta.env.VITE_ADMIN_API_URL ||
  ''
).replace(/\/$/, '');

function buildUrl(path: string) {
  if (!adminApiBaseUrl) {
    throw new Error('Missing VITE_ADMIN_API_URL');
  }

  return `${adminApiBaseUrl}${path}`;
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string
) {
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(buildUrl(path), {
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
