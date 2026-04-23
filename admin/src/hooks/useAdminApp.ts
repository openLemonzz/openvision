import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import type { AdminMe, AdminUser, GenerationRecord, ModelConfig } from '@/lib/types';
import { handleAdminAuthStateChange } from './admin-auth-state';

export function useAdminApp() {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const clearAdminState = useCallback(() => {
    setMe(null);
    setUsers([]);
    setModels([]);
    setHistory([]);
  }, []);

  const refresh = useCallback(async (accessToken?: string | null) => {
    const currentMe = await apiFetch<AdminMe>('/me', {}, accessToken);
    setMe(currentMe);

    if (!currentMe.isAdmin) {
      setUsers([]);
      setModels([]);
      setHistory([]);
      return currentMe;
    }

    const [nextUsers, nextModels, nextHistory] = await Promise.all([
      apiFetch<AdminUser[]>('/users', {}, accessToken),
      apiFetch<ModelConfig[]>('/models', {}, accessToken),
      apiFetch<GenerationRecord[]>('/generations', {}, accessToken),
    ]);

    setUsers(nextUsers);
    setModels(nextModels);
    setHistory(nextHistory);
    return currentMe;
  }, []);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!alive) return;
          clearAdminState();
          setLoading(false);
          return;
        }

        await refresh(data.session.access_token);
      } catch {
        if (!alive) return;
        clearAdminState();
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAdminAuthStateChange({
        session: session
          ? { access_token: session.access_token }
          : null,
        clearAdminState: () => {
          if (!alive) return;
          clearAdminState();
        },
        setLoading: (nextLoading) => {
          if (!alive) return;
          setLoading(nextLoading);
        },
        syncAdminState: async (accessToken) => {
          if (!alive) return;
          await refresh(accessToken);
        },
        onSyncError: () => {
          if (!alive) return;
          clearAdminState();
        },
      });
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [clearAdminState, refresh]);

  const adminLogin = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }

    const currentMe = await refresh(data.session?.access_token);
    return currentMe.isAdmin;
  }, [refresh]);

  const adminLogout = useCallback(async () => {
    await supabase.auth.signOut();
    clearAdminState();
  }, [clearAdminState]);

  const toggleUserStatus = useCallback(async (id: string) => {
    const current = users.find((user) => user.id === id);
    if (!current) return;

    const nextStatus = current.status === 'banned' ? 'active' : 'banned';
    await apiFetch(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    setUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, status: nextStatus } : user))
    );
  }, [users]);

  const updateModels = useCallback(async (nextModels: ModelConfig[]) => {
    await Promise.all(
      nextModels.map((model) =>
        apiFetch(`/models/${encodeURIComponent(model.id)}`, {
          method: 'PUT',
          body: JSON.stringify(model),
        })
      )
    );
    setModels(nextModels.map((model) => ({ ...model, apiKey: '' })));
  }, []);

  const deleteGeneration = useCallback(async (id: string) => {
    await apiFetch(`/generations/${id}`, { method: 'DELETE' });
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const deleteUser = useCallback(async (id: string) => {
    await apiFetch(`/users/${id}`, { method: 'DELETE' });
    setUsers((prev) => prev.filter((user) => user.id !== id));
  }, []);

  return {
    loading,
    me,
    users,
    models,
    history,
    isAdminLoggedIn: !!me?.isAdmin,
    adminLogin,
    adminLogout,
    toggleUserStatus,
    deleteUser,
    updateModels,
    deleteGeneration,
    refresh,
  };
}
