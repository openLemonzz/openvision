import { useState, useEffect, useCallback } from 'react';
import { supabaseEnabled } from '@/lib/supabase';
import type { AdminUser } from '@/pages/admin/AdminUsers';
import type { ModelConfig, ApiProtocol } from '@/pages/admin/AdminModels';

const ADMIN_AUTH_KEY = 'vision_admin_auth';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const MODELS_KEY = 'vision_admin_models';
const USERS_KEY = 'vision_admin_users';

// Demo users
const DEMO_USERS: AdminUser[] = [
  { id: 'u1', username: 'Alice', email: 'alice@example.com', status: 'active', role: 'user', createdAt: '2026-04-01', generationCount: 12, inviteCount: 2 },
  { id: 'u2', username: 'Bob', email: 'bob@example.com', status: 'active', role: 'user', createdAt: '2026-04-05', generationCount: 8, inviteCount: 0 },
  { id: 'u3', username: 'Charlie', email: 'charlie@example.com', status: 'banned', role: 'user', createdAt: '2026-04-08', generationCount: 3, inviteCount: 1 },
  { id: 'u4', username: 'David', email: 'david@example.com', status: 'active', role: 'admin', createdAt: '2026-04-10', generationCount: 25, inviteCount: 5 },
  { id: 'u5', username: 'Eve', email: 'eve@example.com', status: 'active', role: 'user', createdAt: '2026-04-12', generationCount: 0, inviteCount: 0 },
  { id: 'u6', username: 'Frank', email: 'frank@example.com', status: 'active', role: 'user', createdAt: '2026-04-15', generationCount: 6, inviteCount: 1 },
];

// Default model configs
const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'gpt-image-2', name: 'GPT-Image-2', provider: 'Custom API',
    apiKey: '', apiEndpoint: 'http://43.153.120.226:30003/v1/images/generations',
    enabled: true, maxTokens: 1000, temperature: 0.7,
    defaultSize: '1024x1024', protocol: 'openai' as ApiProtocol,
  },
  {
    id: 'gpt-image-1', name: 'GPT-Image-1', provider: 'Custom API',
    apiKey: '', apiEndpoint: 'http://43.153.120.226:30003/v1/images/generations',
    enabled: false, maxTokens: 1000, temperature: 0.7,
    defaultSize: '1024x1024', protocol: 'openai' as ApiProtocol,
  },
];

function loadUsers(): AdminUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || 'null') || [...DEMO_USERS]; }
  catch { return [...DEMO_USERS]; }
}
function saveUsers(users: AdminUser[]) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

function loadModels(): ModelConfig[] {
  try {
    const saved = JSON.parse(localStorage.getItem(MODELS_KEY) || 'null');
    if (!saved || !Array.isArray(saved) || saved.length === 0) return DEFAULT_MODELS.map(m => ({ ...m }));
    return saved.map((m: Partial<ModelConfig>) => ({
      id: m.id || 'unknown', name: m.name || 'Unnamed Model', provider: m.provider || 'Unknown',
      apiKey: m.apiKey ?? '', apiEndpoint: m.apiEndpoint ?? '', enabled: m.enabled ?? true,
      maxTokens: m.maxTokens ?? 1000, temperature: m.temperature ?? 0.7,
      defaultSize: m.defaultSize || '1024x1024', protocol: m.protocol || 'openai',
    }));
  } catch { return DEFAULT_MODELS.map(m => ({ ...m })); }
}
function saveModels(models: ModelConfig[]) { localStorage.setItem(MODELS_KEY, JSON.stringify(models)); }

export function useAdmin() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => localStorage.getItem(ADMIN_AUTH_KEY) === 'true');
  const [users, setUsers] = useState<AdminUser[]>(loadUsers);
  const [models, setModels] = useState<ModelConfig[]>(loadModels);

  // Load real users from Supabase auth when admin is logged in
  useEffect(() => {
    if (!isAdminLoggedIn || !supabaseEnabled) return;
    const fetchRealUsers = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: DEFAULT_ADMIN_PASSWORD }),
        });
        const data = await res.json();
        if (data.users && Array.isArray(data.users)) {
          console.log('[Admin] Loaded', data.users.length, 'real users from Supabase auth');
          setUsers(data.users);
        } else {
          console.error('[Admin] Failed to load real users:', data.error);
        }
      } catch (e) {
        console.error('[Admin] Error fetching real users:', e);
      }
    };
    fetchRealUsers();
  }, [isAdminLoggedIn]);

  useEffect(() => { if (!supabaseEnabled) saveUsers(users); }, [users]);
  useEffect(() => { saveModels(models); }, [models]);

  const adminLogin = useCallback((password: string) => {
    if (password === DEFAULT_ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_AUTH_KEY, 'true');
      setIsAdminLoggedIn(true);
      return true;
    }
    return false;
  }, []);

  const adminLogout = useCallback(() => {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    setIsAdminLoggedIn(false);
  }, []);

  const toggleUserStatus = useCallback((id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'banned' : 'active' as const } : u));
  }, []);

  const updateModels = useCallback((newModels: ModelConfig[]) => { setModels(newModels); }, []);

  return { isAdminLoggedIn, users, models, adminLogin, adminLogout, toggleUserStatus, updateModels };
}
