import { useCallback, useEffect, useState } from 'react';
import AsciiCanvas from '../components/AsciiCanvas';
import GenerateConsole from '../components/GenerateConsole';
import HistoryStream from '../components/HistoryStream';
import type { GenerationRecord } from '../hooks/useGeneration';
import type { ModelConfig } from './admin/AdminModels';
import {
  HOME_HERO_SLOGAN,
  HOME_HERO_SLOGAN_DELAY_MS,
  HOME_HERO_SLOGAN_STEP_MS,
  getTypewriterText,
} from '../lib/home-intro';

interface HomeProps {
  homeIntroStartedAtMs: number | null;
  playHomeIntroAnimation: boolean;
  isGenerating: boolean;
  isLoggedIn: boolean;
  history: GenerationRecord[];
  models: ModelConfig[];
  modelsError: string | null;
  modelsLoading: boolean;
  lifecycleTick: number;
  onGenerate: (prompt: string, aspectRatio: '1:1' | '16:9' | '3:4' | '9:16', styleStrength: number, engine: string) => Promise<string>;
  onRequireAuth: () => void;
  onDeleteRecord: (id: string) => void;
}

const HOME_HERO_SLOGAN_TOTAL_MS =
  HOME_HERO_SLOGAN_DELAY_MS + HOME_HERO_SLOGAN_STEP_MS * Array.from(HOME_HERO_SLOGAN).length;

export default function Home({
  homeIntroStartedAtMs,
  playHomeIntroAnimation,
  isGenerating,
  isLoggedIn,
  history,
  models,
  modelsError,
  modelsLoading,
  lifecycleTick,
  onGenerate,
  onRequireAuth,
  onDeleteRecord,
}: HomeProps) {
  const [remixPrompt, setRemixPrompt] = useState<string | undefined>(undefined);
  const [sloganElapsedMs, setSloganElapsedMs] = useState(() =>
    homeIntroStartedAtMs === null ? 0 : Math.max(0, Date.now() - homeIntroStartedAtMs)
  );

  const handleGenerate = useCallback(
    (prompt: string, aspectRatio: '1:1' | '16:9' | '3:4' | '9:16', styleStrength: number, engine: string) => {
      return onGenerate(prompt, aspectRatio, styleStrength, engine);
    },
    [onGenerate]
  );

  useEffect(() => {
    if (homeIntroStartedAtMs === null) {
      setSloganElapsedMs(0);
      return;
    }

    const updateElapsedMs = () => {
      const nextElapsedMs = Math.max(0, Date.now() - homeIntroStartedAtMs);
      setSloganElapsedMs(nextElapsedMs);
      return nextElapsedMs;
    };

    if (updateElapsedMs() >= HOME_HERO_SLOGAN_TOTAL_MS) {
      return;
    }

    const timerId = window.setInterval(() => {
      if (updateElapsedMs() >= HOME_HERO_SLOGAN_TOTAL_MS) {
        window.clearInterval(timerId);
      }
    }, 40);

    return () => {
      window.clearInterval(timerId);
    };
  }, [homeIntroStartedAtMs]);

  const resolvedSlogan =
    homeIntroStartedAtMs === null
      ? HOME_HERO_SLOGAN
      : getTypewriterText(HOME_HERO_SLOGAN, sloganElapsedMs, {
          startDelayMs: HOME_HERO_SLOGAN_DELAY_MS,
          stepMs: HOME_HERO_SLOGAN_STEP_MS,
        });
  const showSloganCursor =
    homeIntroStartedAtMs !== null && resolvedSlogan !== HOME_HERO_SLOGAN;

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
          <div className={`text-center mb-10 ${playHomeIntroAnimation ? 'home-hero-enter' : ''}`}>
            <p className="text-[10px] text-[#B8B8B8] uppercase tracking-[0.34em] font-mono-data mb-4">
              AIGC · Image Generation Platform
            </p>
            <h1
              className="text-[clamp(36px,6vw,72px)] font-normal text-white leading-[0.95] tracking-[0.02em] uppercase"
              style={{ fontFamily: "'Geist Pixel', 'IBM Plex Mono', ui-monospace, monospace" }}
            >
              VISION
            </h1>
            <p className="mt-4 min-h-[1.6em] text-[13px] text-[#CFCFCF] uppercase tracking-[0.28em] font-mono-data">
              <span className="inline-block align-top">{resolvedSlogan || ' '}</span>
              {showSloganCursor ? (
                <span aria-hidden="true" className="home-slogan-cursor ml-1 inline-block align-top text-white/70">
                  _
                </span>
              ) : null}
            </p>
          </div>

          {/* Generation Console */}
          <GenerateConsole
            isGenerating={isGenerating}
            isLoggedIn={isLoggedIn}
            models={models}
            modelsError={modelsError}
            modelsLoading={modelsLoading}
            remixPrompt={remixPrompt}
            onGenerate={handleGenerate}
            onRequireAuth={onRequireAuth}
          />
        </section>

        {/* History Stream */}
        <HistoryStream records={history.slice(0, 1)} onDelete={onDeleteRecord} onRemix={setRemixPrompt} lifecycleTick={lifecycleTick} />
      </div>
    </div>
  );
}
