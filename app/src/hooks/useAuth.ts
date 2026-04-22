import { useState, useEffect, useCallback } from 'react';
import { getFunctionUrl, supabase, supabaseEnabled } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ======== Types ========
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  inviteCode: string;
  inviteCount: number;
}

// ======== LocalStorage Auth (Fallback) ========
const LOCAL_STORAGE_KEY = 'vision_auth_fallback';
const LOCAL_USERS_KEY = 'vision_users_fallback';

function loadLocalUsers(): Record<string, { username: string; email: string; password: string; inviteCode: string; inviteCount: number }> {
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}'); } catch { return {}; }
}
function saveLocalUsers(users: Record<string, unknown>) { localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users)); }
function genLocalInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// ======== Hook ========
export function useAuth() {
  // -- Supabase user (if enabled) --
  const [sbUser, setSbUser] = useState<SupabaseUser | null>(null);

  // -- Local user (fallback) --
  const [localUser, setLocalUser] = useState<UserProfile | null>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || 'null'); } catch { return null; }
  });

  const [loading, setLoading] = useState(() => supabaseEnabled);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');

  // Determine active user
  const user: UserProfile | null = sbUser
    ? {
        id: sbUser.id,
        username: sbUser.user_metadata?.username || sbUser.email?.split('@')[0] || 'User',
        email: sbUser.email || '',
        inviteCode: sbUser.user_metadata?.invite_code || '',
        inviteCount: 0, // fetched separately
      }
    : localUser;

  // Listen for Supabase auth state changes
  useEffect(() => {
    if (!supabaseEnabled) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSbUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSbUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const openLogin = useCallback(() => {
    setAuthMode('login');
    setShowAuthModal(true);
    setError('');
  }, []);

  const openRegister = useCallback(() => {
    setAuthMode('register');
    setShowAuthModal(true);
    setError('');
  }, []);

  const closeAuth = useCallback(() => {
    setShowAuthModal(false);
    setError('');
    setConfirmationMessage('');
  }, []);

  // ======== Login ========
  const login = useCallback(async (email: string, password: string) => {
    if (supabaseEnabled) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials' ? '邮箱或密码错误' : signInError.message);
        return false;
      }
    } else {
      // Local fallback
      const users = loadLocalUsers();
      const found = Object.entries(users).find(([, u]) => u.email === email && u.password === password);
      if (!found) { setError('邮箱或密码错误'); return false; }
      const [id, u] = found;
      const profile: UserProfile = { id, username: u.username, email: u.email, inviteCode: u.inviteCode, inviteCount: u.inviteCount };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      setLocalUser(profile);
    }
    setShowAuthModal(false);
    setError('');
    return true;
  }, []);

  // ======== Register ========
  const register = useCallback(async (username: string, email: string, password: string, inviteCode?: string) => {
    if (supabaseEnabled) {
      // Check if email already exists before signing up
      try {
        const checkRes = await fetch(getFunctionUrl('check-email'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const checkData = await checkRes.json();
        if (checkData.exists) {
          setError('该邮箱已被注册，请直接登录');
          return false;
        }
      } catch (e) {
        console.error('[Auth] Check email error:', e);
        // Continue anyway, let signUp handle it as fallback
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: { data: { username, invite_code: inviteCode || null } },
      });
      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists')) {
          setError('该邮箱已被注册，请直接登录');
        } else if (msg.includes('email') && (msg.includes('invalid') || msg.includes('format'))) {
          setError('邮箱格式不正确');
        } else if (msg.includes('password')) {
          setError('密码强度不足，请至少6位');
        } else {
          setError(signUpError.message);
        }
        return false;
      }
      // If session is null, email confirmation is required
      if (!data.session) {
        setConfirmationMessage('注册成功！请前往邮箱查收确认邮件，点击链接完成验证。');
        setError('');
        return true;
      }
    } else {
      // Local fallback
      const users = loadLocalUsers();
      if (Object.values(users).some(u => u.email === email)) { setError('该邮箱已被注册'); return false; }
      if (Object.values(users).some(u => u.username === username)) { setError('该用户名已被使用'); return false; }

      // Check invite code
      if (inviteCode) {
        const inviter = Object.entries(users).find(([, u]) => u.inviteCode === inviteCode);
        if (inviter) { const [inviterId, inviterData] = inviter; users[inviterId] = { ...inviterData, inviteCount: inviterData.inviteCount + 1 }; }
      }

      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newInviteCode = genLocalInviteCode();
      users[id] = { username, email, password, inviteCode: newInviteCode, inviteCount: 0 };
      saveLocalUsers(users);

      const profile: UserProfile = { id, username, email, inviteCode: newInviteCode, inviteCount: 0 };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      setLocalUser(profile);
    }
    setShowAuthModal(false);
    setError('');
    setConfirmationMessage('');
    return true;
  }, []);

  // ======== Logout ========
  const logout = useCallback(async () => {
    if (supabaseEnabled) await supabase.auth.signOut();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setLocalUser(null);
    setSbUser(null);
  }, []);

  return {
    user,
    profile: user,
    isLoggedIn: !!user,
    loading,
    showAuthModal,
    authMode,
    setAuthMode,
    error,
    confirmationMessage,
    openLogin,
    openRegister,
    closeAuth,
    login,
    register,
    logout,
  };
}
