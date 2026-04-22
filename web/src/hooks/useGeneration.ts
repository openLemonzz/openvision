import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { adminFetch } from '@/lib/admin-api';
import type { ModelConfig } from '@/pages/admin/AdminModels';

export type AspectRatio = '1:1' | '16:9' | '3:4' | '9:16';

export interface GenerationRecord {
  id: string;
  pictureId: string | null;
  prompt: string;
  aspectRatio: AspectRatio;
  styleStrength: number;
  engine: string;
  imageUrl: string;
  createdAt: number;
  expiresAt: number | null;
  lifecycle: LifecycleStatus;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  isFavorite: boolean;
  userId?: string;
}

export type LifecycleStatus = 'pending' | 'generating' | 'active' | 'expiring' | 'expired' | null;

export interface LifecycleInfo {
  lifecycle: LifecycleStatus;
  progress: number;
  remainingText: string;
}

export function calculateLifecycle(record: GenerationRecord): LifecycleInfo {
  const logPrefix = `[LC] record=${record.id.slice(0, 8)}`;

  // Creation flow states
  if (record.status === 'pending') {
    const elapsed = Date.now() - record.createdAt;
    const progress = Math.min(25, (elapsed % 4000) / 4000 * 25);
    console.log(`${logPrefix} status=pending → lifecycle=pending progress=${progress.toFixed(1)}%`);
    return { lifecycle: 'pending', progress, remainingText: '等待中' };
  }
  if (record.status === 'generating') {
    const elapsed = Date.now() - record.createdAt;
    const base = 25 + ((elapsed % 2500) / 2500) * 55;
    console.log(`${logPrefix} status=generating → lifecycle=generating progress=${Math.min(80, base).toFixed(1)}%`);
    return { lifecycle: 'generating', progress: Math.min(80, base), remainingText: '生成中' };
  }
  if (record.status === 'failed') {
    console.log(`${logPrefix} status=failed → lifecycle=expired`);
    return { lifecycle: 'expired', progress: 0, remainingText: '生成失败' };
  }

  // Lifecycle states (completed)
  if (!record.expiresAt || record.status !== 'completed') {
    console.log(`${logPrefix} status=${record.status} expiresAt=${record.expiresAt} → lifecycle=null (not completed/no expiry)`);
    return { lifecycle: null, progress: 100, remainingText: '' };
  }
  const now = Date.now();
  const expires = record.expiresAt;
  const created = record.createdAt;
  const total = Math.max(1, expires - created);
  const remaining = expires - now;

  if (remaining <= 0) {
    console.log(`${logPrefix} remaining=${remaining}ms ≤ 0 → lifecycle=expired`);
    return { lifecycle: 'expired', progress: 0, remainingText: '已过期' };
  }

  const progress = Math.max(0, Math.min(100, (remaining / total) * 100));
  const lifecycle: LifecycleStatus = progress < 30 ? 'expiring' : 'active';

  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  let remainingText = '';
  if (days > 0) remainingText = `${days}天`;
  else if (hours > 0) remainingText = `${hours}小时`;
  else remainingText = '即将过期';

  console.log(`${logPrefix} status=completed remaining=${remaining}ms progress=${progress.toFixed(1)}% → lifecycle=${lifecycle} text=${remainingText}`);
  return { lifecycle, progress, remainingText };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// ======== Hook ========
export function useGeneration(userId: string | undefined, models: ModelConfig[]) {
  const authClient = supabase.auth as {
    getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
  };
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);
  const [lifecycleTick, setLifecycleTick] = useState(Date.now());

  const getAccessToken = useCallback(async () => {
    const { data: sessionData } = await authClient.getSession();
    return sessionData.session?.access_token ?? null;
  }, [authClient]);

  // Polling: re-calculate lifecycle every 30s
  useEffect(() => {
    console.log('[FE] lifecycleTick timer started (30s interval)');
    const interval = setInterval(() => {
      const tick = Date.now();
      console.log(`[FE] lifecycleTick fired at ${new Date(tick).toLocaleTimeString()}, recalculating ${history.length} records...`);
      history.forEach(r => {
        if (r.status === 'completed' && r.expiresAt) {
          const info = calculateLifecycle(r);
          console.log(`[FE]   tick recalc ${r.id.slice(0, 8)} → ${info.lifecycle} ${info.progress.toFixed(1)}% ${info.remainingText}`);
        }
      });
      setLifecycleTick(tick);
    }, 30000);
    return () => { console.log('[FE] lifecycleTick timer stopped'); clearInterval(interval); };
  }, [history]);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!userId) {
      setHistory([]);
      return;
    }
    console.log('[FE] loadHistory() start, userId:', userId);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setHistory([]);
      return;
    }

    try {
      const records = await adminFetch<GenerationRecord[]>('/my/generations', {}, accessToken);
      console.log(`[FE] loadHistory() loaded ${records.length} records`);
      setHistory(records);
    } catch (error) {
      console.error('[FE] Failed to load history:', getErrorMessage(error));
      setHistory([]);
    }
  }, [getAccessToken, userId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Generate
  const generate = useCallback(async (
    prompt: string,
    aspectRatio: AspectRatio,
    styleStrength: number,
    engine: string
  ) => {
    if (generatingRef.current || !userId) {
      console.warn('[FE] Generate skipped: generatingRef=', generatingRef.current, 'userId=', userId);
      return '';
    }

    console.log('[FE] ========== GENERATE START ==========');
    console.log('[FE] userId:', userId);
    console.log('[FE] engine:', engine);
    console.log('[FE] prompt:', prompt.slice(0, 80));
    console.log('[FE] aspectRatio:', aspectRatio);

    // Find model config by engine id
    const modelConfig = models.find(m => m.id === engine);
    console.log('[FE] modelConfig found:', !!modelConfig, 'id:', modelConfig?.id, 'name:', modelConfig?.name, 'protocol:', modelConfig?.protocol);
    if (!modelConfig) {
      toast.error(`模型 "${engine}" 未找到，请检查后台配置`);
      console.error('[FE] Model not found:', engine, 'Available:', models.map(m => ({ id: m.id, name: m.name, enabled: m.enabled })));
      return '';
    }

    generatingRef.current = true;
    setIsGenerating(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error('请先登录后再生成');
        return '';
      }

      const response = await adminFetch<{ id: string }>(
        '/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: prompt.trim(),
            modelId: modelConfig.id,
            aspectRatio,
            styleStrength,
          }),
        },
        accessToken
      );

      await loadHistory();

      generatingRef.current = false;
      setIsGenerating(false);
      console.log('[FE] ========== GENERATE END (success) ==========');
      return response.id;
    } catch (err: unknown) {
      toast.error('生成异常: ' + getErrorMessage(err));
      console.error('[FE] ========== GENERATE END (CRASH) ==========');
      console.error('[FE] Generation crash:', getErrorMessage(err), err);
      generatingRef.current = false;
      setIsGenerating(false);
      return '';
    }
  }, [getAccessToken, loadHistory, models, userId]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (id: string) => {
    if (!userId) return;
    const record = history.find(r => r.id === id);
    if (!record) return;
    const nextFavorite = !record.isFavorite;

    const accessToken = await getAccessToken();
    if (!accessToken) return;

    await adminFetch(
      `/my/generations/${id}/favorite`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: nextFavorite }),
      },
      accessToken
    );

    setHistory(prev => {
      return prev.map(r => r.id === id ? { ...r, isFavorite: nextFavorite } : r);
    });
  }, [getAccessToken, history, userId]);

  // Delete
  const deleteRecord = useCallback(async (id: string) => {
    if (!userId) return;
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    await adminFetch(`/my/generations/${id}`, { method: 'DELETE' }, accessToken);

    setHistory(prev => {
      return prev.filter(r => r.id !== id);
    });
  }, [getAccessToken, userId]);

  const favoriteRecords = history.filter(r => r.isFavorite);

  return { history, favoriteRecords, isGenerating, generate, toggleFavorite, deleteRecord, refreshHistory: loadHistory, lifecycleTick };
}
