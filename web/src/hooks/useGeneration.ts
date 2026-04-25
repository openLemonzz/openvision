import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { adminFetch } from '@/lib/admin-api';
import {
  buildGenerateRequestPayload,
  countActiveGenerations,
  type GenerationCapacitySnapshot,
} from '@/lib/utils';
import type { ModelConfig } from '@/pages/admin/AdminModels';

export type AspectRatio = '1:1' | '16:9' | '3:4' | '9:16';

export interface GenerationRecord {
  id: string;
  generationCode: string | null;
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
  const rawMessage = error instanceof Error ? error.message : String(error);

  try {
    const payload = JSON.parse(rawMessage) as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // ignore non-JSON error payloads
  }

  return rawMessage;
}

// ======== Hook ========
export function useGeneration(userId: string | undefined, models: ModelConfig[]) {
  const authClient = supabase.auth as {
    getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
  };
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [lifecycleTick, setLifecycleTick] = useState(Date.now());
  const [capacity, setCapacity] = useState<GenerationCapacitySnapshot | null>(null);
  const [isCheckingCapacity, setIsCheckingCapacity] = useState(false);
  const [isWaitingForCapacityConfirmation, setIsWaitingForCapacityConfirmation] = useState(false);

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
      // 按创建时间降序排列，确保最新的记录在最前面
      records.sort((a, b) => b.createdAt - a.createdAt);
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

  const loadGenerationCapacity = useCallback(async () => {
    if (!userId) {
      setCapacity(null);
      setIsCheckingCapacity(false);
      setIsWaitingForCapacityConfirmation(false);
      return;
    }

    setIsCheckingCapacity(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setCapacity(null);
        return;
      }

      const nextCapacity = await adminFetch<GenerationCapacitySnapshot>('/my/generation-capacity', {}, accessToken);
      setCapacity(nextCapacity);
      setIsWaitingForCapacityConfirmation(false);
    } catch (error) {
      console.error('[FE] Failed to load generation capacity:', getErrorMessage(error));
      setCapacity(null);
    } finally {
      setIsCheckingCapacity(false);
    }
  }, [getAccessToken, userId]);

  useEffect(() => {
    if (!userId) {
      setCapacity(null);
      setIsCheckingCapacity(false);
      setIsWaitingForCapacityConfirmation(false);
      return;
    }

    void loadGenerationCapacity();
    const interval = window.setInterval(() => {
      void loadGenerationCapacity();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadGenerationCapacity, userId]);

  const activeGenerationCount = countActiveGenerations(history);
  const isGenerating = activeGenerationCount > 0;

  // Generate
  const generate = useCallback(async (
    prompt: string,
    aspectRatio: AspectRatio,
    styleStrength: number,
    engine: string,
    referenceImageUrl?: string | null,
  ) => {
    if (!userId) {
      console.warn('[FE] Generate skipped: userId=', userId);
      return '';
    }

    setIsWaitingForCapacityConfirmation(true);

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

    const tempId = `temp-${Date.now()}`;
    const tempRecord: GenerationRecord = {
      id: tempId,
      generationCode: null,
      pictureId: null,
      prompt,
      aspectRatio,
      styleStrength,
      engine: modelConfig.id,
      imageUrl: '',
      createdAt: Date.now(),
      expiresAt: null,
      lifecycle: 'pending',
      status: 'pending',
      isFavorite: false,
      userId,
    };

    let success = false;
    setHistory(prev => [tempRecord, ...prev]);

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
          body: JSON.stringify(buildGenerateRequestPayload({
            prompt: prompt.trim(),
            modelId: modelConfig.id,
            aspectRatio,
            styleStrength,
            referenceImageUrl,
          })),
        },
        accessToken
      );

      success = true;

      // 用真实 ID 更新临时记录为生成中状态，让用户立刻看到占位
      setHistory(prev => prev.map(r =>
        r.id === tempId
          ? { ...r, id: response.id, status: 'generating' as const, lifecycle: 'generating' as const }
          : r
      ));

      // 延迟刷新历史记录，给后端数据库同步时间
      setTimeout(() => void loadHistory(), 1200);
      setTimeout(() => void loadGenerationCapacity(), 1200);
      setTimeout(() => void loadHistory(), 3500);
      setTimeout(() => void loadGenerationCapacity(), 3500);

      console.log('[FE] ========== GENERATE END (success) ==========');
      return response.id;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      if (message === 'Concurrency limit reached') {
        toast.error('已达到并发上限');
      } else {
        toast.error('生成异常: ' + message);
      }
      console.error('[FE] ========== GENERATE END (CRASH) ==========');
      console.error('[FE] Generation crash:', message, err);
      return '';
    } finally {
      if (!success) {
        setHistory(prev => prev.filter(r => r.id !== tempId));
        setIsWaitingForCapacityConfirmation(false);
      }
    }
  }, [getAccessToken, loadGenerationCapacity, loadHistory, models, userId]);

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

  return {
    history,
    favoriteRecords,
    isGenerating,
    activeGenerationCount,
    capacity,
    isCheckingCapacity,
    isWaitingForCapacityConfirmation,
    generate,
    toggleFavorite,
    deleteRecord,
    refreshHistory: loadHistory,
    refreshGenerationCapacity: loadGenerationCapacity,
    lifecycleTick,
  };
}
