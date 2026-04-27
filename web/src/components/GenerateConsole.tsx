import { useState, useRef, useCallback, useMemo, useEffect, type ClipboardEvent } from 'react';
import { Zap, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
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
  draftAspectRatio?: AspectRatio | null;
  draftStyleStrength?: number | null;
  draftEngine?: string | null;
  onGenerate: (
    prompt: string,
    aspectRatio: AspectRatio,
    styleStrength: number,
    engine: string,
    referenceImageUrl?: string | null,
  ) => Promise<string>;
  onRequireAuth: () => void;
  onSetReferenceImage: (imageUrl: string) => void;
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
  draftAspectRatio,
  draftStyleStrength,
  draftEngine,
  onGenerate,
  onRequireAuth,
  onSetReferenceImage,
  onClearReferenceImage,
}: GenerateConsoleProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [styleStrength, setStyleStrength] = useState(75);
  const [preferredEngine, setPreferredEngine] = useState<string | null>(null);
  const [focusPulse, setFocusPulse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const prevRefUrlRef = useRef<string | null | undefined>(null);

  // 改图触发：scroll + focus + 光圈动画
  useEffect(() => {
    const wasEmpty = !prevRefUrlRef.current;
    const isNowSet = !!referenceImageUrl;
    prevRefUrlRef.current = referenceImageUrl ?? null;

    if (wasEmpty && isNowSet) {
      const t1 = setTimeout(() => {
        consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusPulse(true);
      }, 80);
      const t2 = setTimeout(() => textareaRef.current?.focus(), 450);
      const t3 = setTimeout(() => setFocusPulse(false), 1100);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [referenceImageUrl]);

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
    const generationId = await onGenerate(
      prompt.trim(),
      aspectRatio,
      styleStrength,
      engine,
      referenceImageUrl,
    );
    if (generationId) {
      setPrompt('');
    }
  }, [prompt, aspectRatio, styleStrength, engine, isLoggedIn, onGenerate, onRequireAuth, referenceImageUrl]);

  const handlePaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.kind === 'file' && item.type.startsWith('image/')
    );

    if (!imageItem) {
      return;
    }

    const imageFile = imageItem.getAsFile();
    if (!imageFile) {
      return;
    }

    event.preventDefault();

    if (imageFile.size > 12 * 1024 * 1024) {
      toast.error('参考图不能超过 12MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        toast.error('读取粘贴图片失败');
        return;
      }

      onSetReferenceImage(reader.result);
      toast.success('已载入参考图');
    };
    reader.onerror = () => toast.error('读取粘贴图片失败');
    reader.readAsDataURL(imageFile);
  }, [onSetReferenceImage]);

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
    <div ref={consoleRef} className={`liquid-glass w-full max-w-[540px] p-6 lg:p-8 ${focusPulse ? 'console-focus-ring' : ''}`}>
      {/* Prompt Input */}
      <div className="relative mb-6">
        {/* 参考图：小缩略图 + 右上角叉叉，嵌在 textarea 左上 */}
        {referenceImageUrl ? (
          <div className="mb-3 inline-flex relative group/thumb">
            <img
              src={referenceImageUrl}
              alt=""
              className="h-14 w-14 object-cover border border-[#333] opacity-90"
            />
            <button
              type="button"
              onClick={onClearReferenceImage}
              className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#333] border border-[#555] flex items-center justify-center text-[#aaa] hover:bg-white hover:text-black hover:border-white transition-all z-10"
              aria-label="清除参考图"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleGenerate();
            }
          }}
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
          {modelsError ? (
            <div className="mt-2 flex items-center gap-1.5 text-red-400 text-[11px]">
              <AlertCircle size={12} />
              <span className="font-mono-data">{modelsError}</span>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={modelsLoading || enabledModels.length === 0}
                className="w-full flex items-center justify-between bg-transparent border border-[#262626] px-3 py-2.5 text-[12px] font-mono-data text-[#A8A8A8] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none transition-all hover:border-[#4D4D4D] hover:text-white data-[state=open]:border-[#4D4D4D] data-[state=open]:text-white"
              >
                <span>
                  {modelsLoading
                    ? '加载中...'
                    : enabledModels.find(m => m.id === engine)?.name || engine}
                </span>
                <ChevronDown size={13} className="shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {enabledModels.map(m => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setPreferredEngine(m.id)}
                    className="flex items-center justify-between"
                  >
                    <span>{m.name}</span>
                    {m.id === engine && <Check size={12} className="text-white" />}
                  </DropdownMenuItem>
                ))}
                {enabledModels.length === 0 && !modelsLoading && (
                  <DropdownMenuItem disabled>无可用模型</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
