import { useState, useRef, useCallback, useMemo } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import type { AspectRatio } from '../hooks/useGeneration';
import type { ModelConfig } from '../pages/admin/AdminModels';

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
];

interface GenerateConsoleProps {
  isGenerating: boolean;
  isLoggedIn: boolean;
  models: ModelConfig[];
  modelsError: string | null;
  modelsLoading: boolean;
  onGenerate: (prompt: string, aspectRatio: AspectRatio, styleStrength: number, engine: string) => Promise<string>;
  onRequireAuth: () => void;
}

export default function GenerateConsole({ isGenerating, isLoggedIn, models, modelsError, modelsLoading, onGenerate, onRequireAuth }: GenerateConsoleProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [styleStrength, setStyleStrength] = useState(75);
  const [preferredEngine, setPreferredEngine] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build engine options from enabled models
  const enabledModels = useMemo(() => models.filter(m => m.enabled), [models]);
  const engine = useMemo(() => {
    if (preferredEngine && enabledModels.some((model) => model.id === preferredEngine)) {
      return preferredEngine;
    }

    return enabledModels[0]?.id || 'gpt-image-2';
  }, [enabledModels, preferredEngine]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }
    await onGenerate(prompt.trim(), aspectRatio, styleStrength, engine);
    setPrompt('');
  }, [prompt, aspectRatio, styleStrength, engine, isLoggedIn, onGenerate, onRequireAuth]);

  const buttonLabel = useMemo(() => {
    if (isGenerating) return '生成中...';
    if (modelsLoading) return '加载模型...';
    if (modelsError) return '模型服务异常';
    if (enabledModels.length === 0) return '无可用模型';
    return 'EXECUTE · 执行';
  }, [isGenerating, modelsLoading, modelsError, enabledModels.length]);

  return (
    <div className="liquid-glass w-full max-w-[540px] p-6 lg:p-8">
      {/* Prompt Input */}
      <div className="relative mb-6">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="输入你的梦境，或是一个荒诞的指令..."
          className="w-full bg-transparent text-white text-[15px] leading-relaxed placeholder:text-[#4D4D4D] placeholder:text-[14px] focus:outline-none resize-none min-h-[80px] pr-4"
          rows={3}
        />
        <span
          className="absolute bottom-2 right-0 w-[2px] h-[18px] bg-white"
          style={{ animation: 'blink 1s step-end infinite' }}
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
        disabled={isGenerating || !prompt.trim() || enabledModels.length === 0 || modelsLoading || !!modelsError}
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
    </div>
  );
}
