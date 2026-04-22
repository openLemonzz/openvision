import type { NextFunction, Request, Response } from 'express';
import { config, missingServerConfig } from './config.js';
import { pool } from './db.js';

export interface AuthUser {
  id: string;
  email: string;
  isAdmin?: boolean;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

type SupabaseAdminClient = {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: unknown;
    }>;
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => Promise<{ error: unknown }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

let supabaseAdminClientPromise: Promise<SupabaseAdminClient | null> | null = null;

export async function getSupabaseAdminClient(): Promise<SupabaseAdminClient | null> {
  if (supabaseAdminClientPromise) {
    return supabaseAdminClientPromise;
  }

  supabaseAdminClientPromise = (async () => {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      return null;
    }

    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    ) as unknown as SupabaseAdminClient;
  })();

  return supabaseAdminClientPromise;
}

export type ResolveAuthUser = (token: string) => Promise<AuthUser | null>;
export type QueryResultLike = {
  rows: Array<Record<string, unknown>>;
  rowCount?: number | null;
};
export type QueryFn = (sql: string, params?: unknown[]) => Promise<QueryResultLike>;

export async function resolveBearerAuthUser(token: string) {
  if (!token) {
    return null;
  }

  const supabaseAdmin = await getSupabaseAdminClient();
  const authApi = supabaseAdmin?.auth;
  if (!authApi) {
    return null;
  }
  const {
    data: { user },
    error,
  } = await authApi.getUser(token);

  if (error || !user?.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length);
}

export async function resolveRequestAuthUser(
  req: Request,
  resolveAuthUser: ResolveAuthUser = resolveBearerAuthUser
) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  return resolveAuthUser(token);
}

export async function loadIsAdmin(query: QueryFn, userId: string) {
  const { rowCount } = await query(
    'select 1 from public.admin_roles where user_id = $1 limit 1',
    [userId]
  );

  return Boolean(rowCount);
}

export function createRequireUser(resolveAuthUser: ResolveAuthUser = resolveBearerAuthUser) {
  return async function requireUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (
        resolveAuthUser === resolveBearerAuthUser &&
        (!config.supabaseUrl || !config.supabaseServiceRoleKey)
      ) {
        res.status(503).json({ error: `Missing server config: ${missingServerConfig.join(', ')}` });
        return;
      }

      const user = await resolveRequestAuthUser(req, resolveAuthUser);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      req.authUser = user;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  };
}

export function createRequireAdmin(
  resolveAuthUser: ResolveAuthUser = resolveBearerAuthUser,
  query: QueryFn | null = pool
    ? async (sql, params) => pool.query(sql, params)
    : null
) {
  return async function requireAdmin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (
        (resolveAuthUser === resolveBearerAuthUser &&
          (!config.supabaseUrl || !config.supabaseServiceRoleKey)) ||
        !query
      ) {
        res.status(503).json({ error: `Missing server config: ${missingServerConfig.join(', ')}` });
        return;
      }

      const user = await resolveRequestAuthUser(req, resolveAuthUser);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const isAdmin = await loadIsAdmin(query, user.id);
      if (!isAdmin) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      req.authUser = {
        ...user,
        isAdmin,
      };
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  };
}

export const requireUser = createRequireUser();
export const requireAdmin = createRequireAdmin();
