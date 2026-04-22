import { createClient } from '@supabase/supabase-js';
import { resolveRuntimeConfig } from './runtime-config';

export const appRuntimeConfig = resolveRuntimeConfig({
  envConfig: {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  runtimeConfig: typeof window !== 'undefined' ? window.__APP_CONFIG__ : {},
});

export const supabaseUrl = appRuntimeConfig.supabaseUrl;
export const supabaseAnonKey = appRuntimeConfig.supabaseAnonKey;
export const isDockerRuntime = appRuntimeConfig.runtime === 'docker';
const isConfigured = appRuntimeConfig.supabaseEnabled;

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('http://placeholder.invalid', 'placeholder');

export const supabaseEnabled = isConfigured;

export function getFunctionUrl(name: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${name}`;
}

// Database types
type AspectRatio = '1:1' | '16:9' | '3:4' | '9:16';

export interface GenerationRow {
  id: string;
  picture_id: string | null;
  user_id: string;
  prompt: string;
  aspect_ratio: AspectRatio;
  style_strength: number;
  engine: string;
  image_url: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  picture_expires_at: string | null;
  picture_lifecycle: 'pending' | 'generating' | 'active' | 'expiring' | 'expired' | null;
  is_favorite: boolean;
  created_at: string;
}

export interface InviteRow {
  id: string;
  inviter_id: string;
  invitee_id: string | null;
  invite_code: string;
  created_at: string;
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      generations: {
        Row: GenerationRow;
        Insert: Omit<GenerationRow, 'created_at'>;
        Update: Partial<Omit<GenerationRow, 'id' | 'created_at'>>;
      };
      invites: {
        Row: InviteRow;
        Insert: Omit<InviteRow, 'id' | 'created_at'>;
        Update: Partial<Omit<InviteRow, 'id' | 'created_at'>>;
      };
    };
  };
}
