import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import type { AdminMe, AdminUser, GenerationRecord, ModelConfig } from '@/lib/types';

export function useAdminApp() {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const currentMe = await apiFetch<AdminMe>('/me');
    setMe(currentMe);

    if (!currentMe.isAdmin) {
      setUsers([]);
      setModels([]);
      setHistory([]);
      return currentMe;
    }

    const [nextUsers, nextModels, nextHistory] = await Promise.all([
      apiFetch<AdminUser[]>('/users'),
      apiFetch<ModelConfig[]>('/models'),
      apiFetch<GenerationRecord[]>('/generations'),
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
          setMe(null);
          setLoading(false);
          return;
        }

        await refresh();
      } catch {
        if (!alive) return;
        setMe(null);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return;

      if (!session) {
        setMe(null);
        setUsers([]);
        setModels([]);
        setHistory([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await refresh();
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  const adminLogin = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return false;
    }

    const currentMe = await refresh();
    return currentMe.isAdmin;
  }, [refresh]);

  const adminLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setMe(null);
    setUsers([]);
    setModels([]);
    setHistory([]);
  }, []);

  const toggleUserStatus = useCallback(async (id: string) => {
    const current = users.find((user) => user.id === id);
    if (!current) return;

    const nextStatus = current.status === 'active' ? 'banned' : 'active';
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
    updateModels,
    deleteGeneration,
    refresh,
  };
}
