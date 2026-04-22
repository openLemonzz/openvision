function normalizeAdminApiBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/$/, '');
}

export function buildAdminApiUrl(path: string, baseUrl: string) {
  const normalizedBaseUrl = normalizeAdminApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error('Missing VITE_ADMIN_API_URL');
  }

  return `${normalizedBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function createAdminHeaders(init: RequestInit = {}, accessToken?: string | null) {
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return headers;
}

function resolveAdminApiBaseUrl() {
  return normalizeAdminApiBaseUrl(
    window.__APP_CONFIG__?.VITE_ADMIN_API_URL ||
    import.meta.env.VITE_ADMIN_API_URL ||
    ''
  );
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string | null
) {
  const headers = createAdminHeaders(init, accessToken);
  const response = await fetch(buildAdminApiUrl(path, resolveAdminApiBaseUrl()), {
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
