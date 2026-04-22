import { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { adminFetch } from '@/lib/admin-api';

type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

type SupabaseSession = {
  user: SupabaseUser;
  access_token?: string;
};

interface WebMePayload {
  id: string;
  email: string;
  username: string;
  inviteCode: string | null;
  inviteCount: number;
  isDisabled: boolean;
  isAdmin: boolean;
}

// ======== Types ========
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  inviteCode: string;
  inviteCount: number;
}

// ======== Hook ========
export function useAuth() {
  const authClient = supabase.auth as unknown as {
    getSession: () => Promise<{ data: { session: SupabaseSession | null } }>;
    onAuthStateChange: (
      callback: (event: string, session: SupabaseSession | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword: (args: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
    signUp: (args: {
      email: string;
      password: string;
      options: { data: Record<string, unknown> };
    }) => Promise<{ data: { session: { user: SupabaseUser } | null }; error?: never; } | { data: { session: null }; error?: never; } | { data: { session: { user: SupabaseUser } | null }; error: { message: string } | null }>;
    signOut: () => Promise<{ error?: { message: string } | null }>;
  };

  const [sbUser, setSbUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(() => supabaseEnabled);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');

  const loadProfile = useCallback(async (authUser: SupabaseUser | null, accessToken?: string | null) => {
    if (!authUser || !accessToken) {
      setProfile(null);
      return;
    }

    const me = await adminFetch<WebMePayload>('/me', {}, accessToken);

    if (me.isDisabled) {
      setTimeout(() => {
        void authClient.signOut();
      }, 0);
      setProfile(null);
      setSbUser(null);
      setError('账号已被禁用');
      return;
    }

    setProfile({
      id: me.id,
      username:
        me.username ||
        (typeof authUser.user_metadata?.username === 'string' ? authUser.user_metadata.username : '') ||
        authUser.email?.split('@')[0] ||
        'User',
      email: me.email || authUser.email || '',
      inviteCode: me.inviteCode || '',
      inviteCount: me.inviteCount || 0,
    });
  }, [authClient]);

  // Listen for Supabase auth state changes
  useEffect(() => {
    if (!supabaseEnabled) return;

    authClient.getSession().then(async ({ data: { session } }) => {
      const authUser = session?.user ?? null;
      setSbUser(authUser);
      await loadProfile(authUser, session?.access_token);
      setLoading(false);
    }).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setLoading(false);
    });

    const { data: { subscription } } = authClient.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setSbUser(authUser);
      void loadProfile(authUser, session?.access_token).catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        setProfile(null);
      });
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

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
    const { error: signInError } = await authClient.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? '邮箱或密码错误' : signInError.message);
      return false;
    }
    setShowAuthModal(false);
    setError('');
    return true;
  }, []);

  // ======== Register ========
  const register = useCallback(async (username: string, email: string, password: string, inviteCode?: string) => {
    const { data, error: signUpError } = await authClient.signUp({
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
    if (!data.session) {
      setConfirmationMessage('注册成功！请前往邮箱查收确认邮件，点击链接完成验证。');
      setError('');
      return true;
    }
    setShowAuthModal(false);
    setError('');
    setConfirmationMessage('');
    return true;
  }, []);

  // ======== Logout ========
  const logout = useCallback(async () => {
    if (supabaseEnabled) await authClient.signOut();
    setProfile(null);
    setSbUser(null);
  }, [authClient]);

  return {
    user: sbUser,
    profile,
    isLoggedIn: !!sbUser,
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
