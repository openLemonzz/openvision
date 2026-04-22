import type { NextFunction, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config, missingServerConfig } from './config.js';
import { pool } from './db.js';

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    email: string;
  };
}

export const supabaseAdmin = config.supabaseUrl && config.supabaseServiceRoleKey
  ? createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )
  : null;

const authApi = supabaseAdmin
  ? (supabaseAdmin.auth as {
      getUser: (token: string) => Promise<{
        data: { user: { id: string; email?: string | null } | null };
        error: unknown;
      }>;
    })
  : null;

async function resolveAuthUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  if (!authApi) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length);
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

export async function requireUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!authApi) {
      res.status(503).json({ error: `Missing server config: ${missingServerConfig.join(', ')}` });
      return;
    }

    const user = await resolveAuthUser(req);
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
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!authApi || !pool) {
      res.status(503).json({ error: `Missing server config: ${missingServerConfig.join(', ')}` });
      return;
    }

    const user = await resolveAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { rowCount } = await pool.query(
      'select 1 from public.admin_roles where user_id = $1 limit 1',
      [user.id]
    );

    if (!rowCount) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    req.authUser = user;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
}
