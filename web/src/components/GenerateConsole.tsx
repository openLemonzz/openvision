import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import type { AspectRatio } from '../hooks/useGeneration';
import type { ModelConfig } from '../pages/admin/AdminModels';
import {
  resolveGenerateAvailability,
  type GenerationCapacitySnapshot,
} from '../lib/utils';

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
];

interface GenerateConsoleProps {
  isGenerating: boolean;
  isLoggedIn: boolean;
  capacity: GenerationCapacitySnapshot | null;
  isCheckingCapacity: boolean;
  isWaitingForCapacityConfirmation: boolean;
  models: ModelConfig[];
  modelsError: string | null;
  modelsLoading: boolean;
  referenceImageUrl?: string | null;
  remixPrompt?: string;
  draftAspectRatio?: AspectRatio | null;
  draftStyleStrength?: number | null;
  draftEngine?: string | null;
  onGenerate: (prompt: string, aspectRatio: AspectRatio, styleStrength: number, engine: string) => Promise<string>;
  onRequireAuth: () => void;
  onClearReferenceImage: () => void;
}

export default function GenerateConsole({
  isGenerating,
  isLoggedIn,
  capacity,
  isCheckingCapacity,
  isWaitingForCapacityConfirmation,
  models,
  modelsError,
  modelsLoading,
  referenceImageUrl,
  remixPrompt,
  draftAspectRatio,
  draftStyleStrength,
  draftEngine,
  onGenerate,
  onRequireAuth,
  onClearReferenceImage,
}: GenerateConsoleProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [styleStrength, setStyleStrength] = useState(75);
  const [preferredEngine, setPreferredEngine] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (remixPrompt) {
      setPrompt(remixPrompt);
      textareaRef.current?.focus();
    }
  }, [remixPrompt]);

  useEffect(() => {
    if (draftAspectRatio) {
      setAspectRatio(draftAspectRatio);
    }
  }, [draftAspectRatio]);

  useEffect(() => {
    if (typeof draftStyleStrength === 'number') {
      setStyleStrength(draftStyleStrength);
    }
  }, [draftStyleStrength]);

  useEffect(() => {
    if (draftEngine) {
      setPreferredEngine(draftEngine);
    }
  }, [draftEngine]);

  // Build engine options from enabled models
  const enabledModels = useMemo(() => models.filter(m => m.enabled), [models]);
  const engine = useMemo(() => {
    if (preferredEngine && enabledModels.some((model) => model.id === preferredEngine)) {
      return preferredEngine;
    }

    return enabledModels[0]?.id || 'gpt-image-2';
  }, [enabledModels, preferredEngine]);

  const availability = resolveGenerateAvailability({
    capacity,
    isCheckingCapacity,
    isWaitingForCapacityConfirmation,
  });
  const capacityLocked = isLoggedIn && !availability.canGenerate;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }
    const generationId = await onGenerate(prompt.trim(), aspectRatio, styleStrength, engine);
    if (generationId) {
      setPrompt('');
    }
  }, [prompt, aspectRatio, styleStrength, engine, isLoggedIn, onGenerate, onRequireAuth]);

  const buttonLabel = useMemo(() => {
    if (modelsLoading) return '加载模型...';
    if (modelsError) return '模型服务异常';
    if (isLoggedIn && availability.state === 'blocked') {
      return availability.reason === 'concurrency_limit_reached' ? '并发已满' : '暂不可用';
    }
    if (enabledModels.length === 0) return '无可用模型';
    return 'EXECUTE · 执行';
  }, [availability.reason, availability.state, enabledModels.length, isLoggedIn, modelsError, modelsLoading]);

  const auxiliaryHint = useMemo(() => {
    if (!isLoggedIn) {
      return null;
    }

    if (availability.state === 'blocked') {
      return availability.reason === 'concurrency_limit_reached' ? '当前并发已满' : '当前账号不可生成';
    }

    return null;
  }, [availability.reason, availability.state, isLoggedIn]);

  return (
    <div className="liquid-glass w-full max-w-[540px] p-6 lg:p-8">
      {/* Prompt Input */}
      {referenceImageUrl ? (
        <div className="mb-5 border border-[#262626] bg-black/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] text-[#A8A8A8] uppercase tracking-[0.18em] font-mono-data">
              Edit Mode · 参考图
            </span>
            <button
              type="button"
              onClick={onClearReferenceImage}
              className="text-[10px] text-[#666] font-mono-data uppercase tracking-[0.12em] transition-colors hover:text-white"
            >
              清除
            </button>
          </div>
          <img
            src={referenceImageUrl}
            alt=""
            className="h-20 w-20 border border-[#333] object-cover"
          />
        </div>
      ) : null}

      <div className="relative mb-6">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="输入你的梦境，或是一个荒诞的指令..."
          className="w-full min-h-[80px] resize-none bg-transparent text-[15px] leading-relaxed text-white caret-white placeholder:text-[14px] placeholder:text-[#4D4D4D] focus:outline-none"
          rows={3}
        />
      </div>

      {/* Parameters */}
      <div className="space-y-5 mb-6">
        {/* Aspect Ratio */}
        <div>
          <label className="block text-[10px] text-[#A8A8A8] uppercase tracking-[0.18em] mb-2.5 font-mono-data">
            Aspect Ratio · 画面比例
          </label>
          <div className="flex gap-0">
            {ASPECT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAspectRatio(opt.value)}
                className={`flex-1 text-[11px] py-2 font-mono-data tracking-wider transition-all border ${
                  aspectRatio === opt.value
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-[#A8A8A8] border-[#262626] hover:border-[#4D4D4D] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Style Strength */}
        <div>
          <div className="flex justify-between mb-2.5">
            <label className="text-[10px] text-[#A8A8A8] uppercase tracking-[0.18em] font-mono-data">
              Style Strength · 风格强度
            </label>
            <span className="text-[10px] text-white font-mono-data">{styleStrength}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={styleStrength}
            onChange={e => setStyleStrength(Number(e.target.value))}
            className="w-full h-[1px] appearance-none bg-[#262626] accent-white cursor-pointer"
          />
        </div>

        {/* Engine */}
        <div>
          <label className="block text-[10px] text-[#A8A8A8] uppercase tracking-[0.18em] mb-2.5 font-mono-data">
            Engine · 生成引擎
          </label>
          <select
            value={engine}
            onChange={e => setPreferredEngine(e.target.value)}
            disabled={modelsLoading || !!modelsError || enabledModels.length === 0}
            className="w-full bg-transparent border border-[#262626] text-white text-[12px] px-3 py-2.5 focus:border-white focus:outline-none appearance-none cursor-pointer font-mono-data disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {modelsLoading && (
              <option value="loading" className="bg-black text-white">加载中...</option>
            )}
            {modelsError && (
              <option value="error" className="bg-black text-white">服务异常</option>
            )}
            {enabledModels.length === 0 && !modelsLoading && !modelsError && (
              <option value="gpt-image-2" className="bg-black text-white">gpt-image-2</option>
            )}
            {enabledModels.map(m => (
              <option key={m.id} value={m.id} className="bg-black text-white">
                {m.name}
              </option>
            ))}
          </select>
          {modelsError && (
            <div className="mt-2 flex items-center gap-1.5 text-red-400 text-[11px]">
              <AlertCircle size={12} />
              <span className="font-mono-data">{modelsError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={capacityLocked || !prompt.trim() || enabledModels.length === 0 || modelsLoading || !!modelsError}
        className="relative w-full bg-black text-white text-[13px] font-medium uppercase tracking-[0.2em] py-4 flex items-center justify-center gap-3 hover:bg-[#111] transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-[#262626]"
      >
        {/* REC dot */}
        <span className="absolute top-2 right-3 flex items-center gap-1">
          <span
            className="w-[6px] h-[6px] rounded-full bg-red-500"
            style={{ animation: isGenerating ? 'pulse-dot 1.5s ease-in-out infinite' : 'none' }}
          />
          <span className="text-[8px] text-red-500 font-mono-data tracking-wider">
            {isGenerating ? 'GEN' : 'REC'}
          </span>
        </span>

        <Zap size={15} className={isGenerating ? 'animate-pulse' : ''} />
        {buttonLabel}
      </button>

      {isLoggedIn ? (
        <div className="mt-3 flex items-center justify-between gap-4 text-[10px] text-[#777] font-mono-data uppercase tracking-[0.12em]">
          <span>并发 {capacity ? `${capacity.activeGenerationCount}/${capacity.concurrencyLimit}` : '--/--'}</span>
          <span className={availability.state === 'blocked' ? 'text-amber-300' : 'text-[#8d8d8d]'}>
            {auxiliaryHint || ' '}
          </span>
        </div>
      ) : null}
    </div>
  );
}
