import { useCallback } from 'react';
import AsciiCanvas from '../components/AsciiCanvas';
import GenerateConsole from '../components/GenerateConsole';
import HistoryStream from '../components/HistoryStream';
import type { GenerationRecord } from '../hooks/useGeneration';
import type { ModelConfig } from './admin/AdminModels';

interface HomeProps {
  isGenerating: boolean;
  isLoggedIn: boolean;
  history: GenerationRecord[];
  models: ModelConfig[];
  lifecycleTick: number;
  onGenerate: (prompt: string, aspectRatio: '1:1' | '16:9' | '3:4' | '9:16', styleStrength: number, engine: string) => Promise<string>;
  onRequireAuth: () => void;
  onDeleteRecord: (id: string) => void;
}

export default function Home({ isGenerating, isLoggedIn, history, models, lifecycleTick, onGenerate, onRequireAuth, onDeleteRecord }: HomeProps) {
  const handleGenerate = useCallback(
    (prompt: string, aspectRatio: '1:1' | '16:9' | '3:4' | '9:16', styleStrength: number, engine: string) => {
      return onGenerate(prompt, aspectRatio, styleStrength, engine);
    },
    [onGenerate]
  );

  return (
    <div className="relative min-h-screen bg-black">
      {/* ASCII Background - fixed full screen */}
      <div className="fixed inset-0 z-0">
        <AsciiCanvas />
      </div>

      {/* Content */}
      <div className="relative z-10 pt-[80px] pb-10">
        {/* Hero section with generate console */}
        <section className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4">
          {/* Title */}
          <div className="text-center mb-10">
            <p className="text-[10px] text-[#A8A8A8] uppercase tracking-[0.3em] font-mono-data mb-4">
              AIGC · Image Generation Platform
            </p>
            <h1
              className="text-[clamp(36px,6vw,72px)] font-normal text-white leading-[0.95] tracking-[0.02em] uppercase"
              style={{ fontFamily: "'Geist Pixel', 'IBM Plex Mono', ui-monospace, monospace" }}
            >
              VISION
            </h1>
            <p className="text-[11px] text-[#4D4D4D] uppercase tracking-[0.25em] font-mono-data mt-3">
              影境 · 从数据洪流中按下快门
            </p>
          </div>

          {/* Generation Console */}
          <GenerateConsole
            isGenerating={isGenerating}
            isLoggedIn={isLoggedIn}
            models={models}
            onGenerate={handleGenerate}
            onRequireAuth={onRequireAuth}
          />
        </section>

        {/* History Stream */}
        <HistoryStream records={history.slice(0, 1)} onDelete={onDeleteRecord} lifecycleTick={lifecycleTick} />
      </div>
    </div>
  );
}
