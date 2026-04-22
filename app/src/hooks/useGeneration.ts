import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import type { GenerationRow } from '@/lib/supabase';
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

// ======== LocalStorage Fallback ========
const HISTORY_KEY_PREFIX = 'vision_history_fallback';

function getLocalHistoryKey(userId: string) {
  return `${HISTORY_KEY_PREFIX}:${userId}`;
}

function loadLocalHistory(userId: string): GenerationRecord[] {
  try { return JSON.parse(localStorage.getItem(getLocalHistoryKey(userId)) || '[]'); } catch { return []; }
}

function saveLocalHistory(userId: string, history: GenerationRecord[]) {
  localStorage.setItem(getLocalHistoryKey(userId), JSON.stringify(history));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function mapRowToRecord(row: GenerationRow): GenerationRecord {
  const record: GenerationRecord = {
    id: row.id,
    pictureId: row.picture_id,
    prompt: row.prompt,
    aspectRatio: row.aspect_ratio as AspectRatio,
    styleStrength: row.style_strength,
    engine: row.engine,
    imageUrl: row.image_url || '',
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: row.picture_expires_at ? new Date(row.picture_expires_at).getTime() : null,
    lifecycle: row.picture_lifecycle,
    isFavorite: row.is_favorite ?? false,
    status: row.status as GenerationRecord['status'],
    userId: row.user_id,
  };
  console.log(`[DB→FE] id=${row.id.slice(0, 8)} status=${row.status} lifecycle=${row.picture_lifecycle} picture_id=${row.picture_id?.slice(0, 16) || 'null'} expires_at=${row.picture_expires_at || 'null'}`);
  return record;
}

// ======== Hook ========
export function useGeneration(userId: string | undefined, models: ModelConfig[]) {
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);
  const [lifecycleTick, setLifecycleTick] = useState(Date.now());

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
    if (!userId) return;
    console.log('[FE] loadHistory() start, userId:', userId);

    if (supabaseEnabled) {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) { console.error('[FE] Failed to load history:', error); return; }
      const records = (data || []).map(mapRowToRecord);
      console.log(`[FE] loadHistory() loaded ${records.length} records`);
      records.slice(0, 3).forEach(r => {
        const info = calculateLifecycle(r);
        console.log(`[FE]   record=${r.id.slice(0, 8)} status=${r.status} lifecycle=${r.lifecycle}→calc=${info.lifecycle} progress=${info.progress.toFixed(1)}%`);
      });
      setHistory(records);
    } else {
      setHistory(loadLocalHistory(userId).slice(0, 50));
    }
  }, [userId]);

  // Subscribe to real-time updates (Supabase only)
  useEffect(() => {
    if (!userId) return;

    loadHistory();

    if (!supabaseEnabled) return;

    const channel = supabase
      .channel('generations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'generations', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log(`[FE] Realtime ${payload.eventType} id=${(payload.new as GenerationRow)?.id?.slice(0, 8) || (payload.old as GenerationRow)?.id?.slice(0, 8)}`);
          if (payload.eventType === 'INSERT') {
            const rec = mapRowToRecord(payload.new as GenerationRow);
            const info = calculateLifecycle(rec);
            console.log(`[FE]   INSERT → status=${rec.status} lifecycle=${rec.lifecycle} calc=${info.lifecycle}`);
            setHistory(prev => [rec, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const oldRow = payload.old as GenerationRow;
            const newRow = payload.new as GenerationRow;
            console.log(`[FE]   UPDATE → status: ${oldRow.status}→${newRow.status} lifecycle: ${oldRow.picture_lifecycle}→${newRow.picture_lifecycle} image_url: ${oldRow.image_url ? 'yes' : 'no'}→${newRow.image_url ? 'yes' : 'no'}`);
            setHistory(prev => prev.map(r => r.id === payload.new.id ? mapRowToRecord(payload.new as GenerationRow) : r));
          } else if (payload.eventType === 'DELETE') {
            console.log(`[FE]   DELETE`);
            setHistory(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId, loadHistory]);

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
      let actualRecordId = '';
      const now = Date.now();

      // Create pending record
      if (supabaseEnabled) {
        console.log('[FE] Creating pending record in DB...');
        const { data, error } = await supabase
          .from('generations')
          .insert({ user_id: userId, prompt, aspect_ratio: aspectRatio, style_strength: styleStrength, engine, status: 'pending', picture_lifecycle: 'pending' })
          .select()
          .single();
        if (error || !data) {
          console.error('[FE] Failed to create record:', error);
          generatingRef.current = false;
          setIsGenerating(false);
          return '';
        }
        actualRecordId = data.id;
        console.log('[FE] DB record created, recordId:', actualRecordId);
      } else {
        actualRecordId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        console.log('[FE] Local recordId:', actualRecordId);
      }

      const pendingRecord: GenerationRecord = {
        id: actualRecordId,
        pictureId: null,
        prompt,
        aspectRatio,
        styleStrength,
        engine,
        imageUrl: '',
        createdAt: now,
        expiresAt: null,
        lifecycle: null,
        isFavorite: false,
        status: 'generating',
        userId,
      };
      setHistory(prev => [pendingRecord, ...prev]);
      console.log('[FE] Pending record added to local state');

      if (supabaseEnabled) {
        const invokeBody = {
          prompt: prompt.trim(),
          aspectRatio,
          engine,
          recordId: actualRecordId,
          apiEndpoint: modelConfig.apiEndpoint || undefined,
          apiKey: modelConfig.apiKey || undefined,
          model: modelConfig.id,
          protocol: modelConfig.protocol || 'openai',
        };
        console.log('[FE] Calling Edge Function via fetch (300s timeout), body:', JSON.stringify(invokeBody));

        // Get session token for auth
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          console.error('[FE] No access token available');
          await supabase.from('generations').update({ status: 'failed', picture_lifecycle: 'expired' }).eq('id', actualRecordId).eq('user_id', userId);
          setHistory(prev => prev.map(r => r.id === actualRecordId ? { ...r, status: 'failed', lifecycle: 'expired' } : r));
          generatingRef.current = false;
          setIsGenerating(false);
          return '';
        }

        // Use fetch with 300s timeout instead of supabase.functions.invoke (which has shorter default timeout)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300_000);

        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(invokeBody),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errText = await response.text();
            console.error('[FE] Edge Function HTTP error:', response.status, errText);
            throw new Error(`HTTP ${response.status}: ${errText}`);
          }

          const result = await response.json();
          console.log('[FE] Edge Function response:', JSON.stringify(result).slice(0, 300));

          if (result.error) {
            console.error('[FE] Edge Function returned error in body:', result.error);
            throw new Error(result.error);
          }

          console.log('[FE] Edge Function call completed successfully');
        } catch (fetchErr: unknown) {
          clearTimeout(timeoutId);
          if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
            console.error('[FE] Edge Function fetch aborted (timeout after 300s)');
          } else {
            console.error('[FE] Edge Function fetch error:', getErrorMessage(fetchErr));
          }
          console.log('[FE] [LC] Marking record as failed due to fetch error, recordId:', actualRecordId);
          await supabase
            .from('generations')
            .update({ status: 'failed', picture_lifecycle: 'expired' })
            .eq('id', actualRecordId)
            .eq('user_id', userId);
          setHistory(prev => prev.map(r => r.id === actualRecordId ? { ...r, status: 'failed', lifecycle: 'expired' } : r));
          generatingRef.current = false;
          setIsGenerating(false);
          console.log('[FE] ========== GENERATE END (Edge Function fetch error) ==========');
          return '';
        }

        // Refresh history to pick up DB update
        console.log('[FE] Refreshing history after successful Edge Function call...');
        await loadHistory();
        console.log('[FE] History refreshed');
      } else {
        // Local fallback: simulate generation
        console.log('[FE] Local fallback: simulating generation...');
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));
        const demoImages = [
          '/images/gen-sample-1.jpg',
          '/images/gen-sample-2.jpg',
          '/images/gen-sample-3.jpg',
          '/images/gen-sample-4.jpg',
          '/images/gen-sample-5.jpg',
          '/images/gen-sample-6.jpg',
        ];
        const imageUrl = demoImages[Math.floor(Math.random() * demoImages.length)];
        const completedRecord: GenerationRecord = { ...pendingRecord, status: 'completed', imageUrl };
        const all = loadLocalHistory(userId);
        const updated = [completedRecord, ...all.filter(r => r.id !== actualRecordId)];
        saveLocalHistory(userId, updated);
        setHistory(prev => prev.map(r => r.id === actualRecordId ? completedRecord : r));
        console.log('[FE] Local simulation completed');
      }

      generatingRef.current = false;
      setIsGenerating(false);
      console.log('[FE] ========== GENERATE END (success) ==========');
      return actualRecordId;
    } catch (err: unknown) {
      toast.error('生成异常: ' + getErrorMessage(err));
      console.error('[FE] ========== GENERATE END (CRASH) ==========');
      console.error('[FE] Generation crash:', getErrorMessage(err), err);
      generatingRef.current = false;
      setIsGenerating(false);
      return '';
    }
  }, [userId, loadHistory, models]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (id: string) => {
    if (!userId) return;
    const record = history.find(r => r.id === id);
    if (!record) return;
    const nextFavorite = !record.isFavorite;

    if (supabaseEnabled) {
      await supabase.from('generations').update({ is_favorite: nextFavorite }).eq('id', id).eq('user_id', userId);
    }
    setHistory(prev => {
      const next = prev.map(r => r.id === id ? { ...r, isFavorite: nextFavorite } : r);
      if (!supabaseEnabled) saveLocalHistory(userId, next);
      return next;
    });
  }, [userId, history]);

  // Delete
  const deleteRecord = useCallback(async (id: string) => {
    if (!userId) return;
    if (supabaseEnabled) {
      await supabase.from('generations').delete().eq('id', id).eq('user_id', userId);
    }
    setHistory(prev => {
      const next = prev.filter(r => r.id !== id);
      if (!supabaseEnabled) saveLocalHistory(userId, next);
      return next;
    });
  }, [userId]);

  const favoriteRecords = history.filter(r => r.isFavorite);

  return { history, favoriteRecords, isGenerating, generate, toggleFavorite, deleteRecord, refreshHistory: loadHistory, lifecycleTick };
}
