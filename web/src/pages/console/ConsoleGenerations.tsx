import { useState, useCallback, useEffect } from 'react';
import { Clock, Ratio } from 'lucide-react';
import CopyableMonoValue from '../../components/CopyableMonoValue';
import CopyPromptButton from '../../components/CopyPromptButton';
import GenerationImageActions from '../../components/GenerationImageActions';
import Lightbox from '../../components/ui/Lightbox';
import type { GenerationRecord } from '../../hooks/useGeneration';
import {
  buildGenerationProgressTrack,
  resolveGenerationRecordProgressPhase,
} from '../../lib/utils';

interface ConsoleGenerationsProps {
  history: GenerationRecord[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEditImage: (imageUrl: string, prompt?: string) => void;
  onRetryGenerate: (
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '3:4' | '9:16',
    styleStrength: number,
    engine: string,
  ) => void;
  lifecycleTick?: number;
}

const aspectMap: Record<string, string> = {
  '1:1': '1/1',
  '16:9': '16/9',
  '3:4': '3/4',
  '9:16': '9/16',
};

export default function ConsoleGenerations({ history, onDelete, onToggleFavorite, onEditImage, onRetryGenerate, lifecycleTick }: ConsoleGenerationsProps) {
  void lifecycleTick;

  const completedImages = history
    .filter(r => r.status === 'completed' && r.imageUrl)
    .map(r => r.imageUrl!);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = useCallback((url: string) => {
    const idx = completedImages.indexOf(url);
    setLightboxIndex(idx >= 0 ? idx : null);
  }, [completedImages]);

  // ESC 关闭已由 Lightbox 内部处理
  useEffect(() => {}, []);

  const formatTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  if (history.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-20">
          <p className="text-[12px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">
            暂无生成记录 · 前往工坊开始创作
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-[14px] font-normal text-white tracking-[0.08em]">生成记录</h2>
          <p className="text-[10px] text-[#666] font-mono-data mt-1">
            {history.length} works
          </p>
        </div>
      </div>

      <div className="space-y-0">
        {history.map((record) => (
          <div
            key={record.id}
            className="grid grid-cols-1 md:grid-cols-[280px_1fr] border-t border-[#262626]"
          >
            {/* Metadata panel */}
            <div className="p-5 flex flex-col justify-between border-r border-[#262626] min-h-[140px]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Ratio size={11} className="text-[#4D4D4D]" />
                    <span className="text-[11px] text-[#A8A8A8] font-mono-data">{record.aspectRatio}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Clock size={11} className="text-[#4D4D4D]" />
                    <span className="text-[11px] text-[#A8A8A8] font-mono-data text-right">{formatTime(record.createdAt)}</span>
                  </div>
                  <div className="text-[10px] text-[#4D4D4D] font-mono-data uppercase tracking-wider">
                    {record.engine}
                  </div>
                  <div className="text-[10px] text-[#4D4D4D] font-mono-data text-right">
                    strength: {record.styleStrength}%
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <CopyableMonoValue prefix="gen" value={record.generationCode} />
                  <CopyableMonoValue prefix="pic" value={record.pictureId} />
                </div>
                <ProgressTrack record={record} />
              </div>

              <div className="mt-4 flex items-start gap-2">
                <p className="min-w-0 flex-1 text-[12px] text-[#A8A8A8] leading-relaxed line-clamp-2">
                  {record.prompt}
                </p>
                <CopyPromptButton value={record.prompt} />
              </div>
            </div>

            {/* Image panel */}
            <div className="p-5">
              {record.status === 'pending' ? (
                <div className="group relative w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]" style={{ aspectRatio: aspectMap[record.aspectRatio] || '1/1' }}>
                  <GenerationImageActions onDelete={() => onDelete(record.id)} />
                  <div className="text-center">
                    <div className="w-3 h-3 bg-[#444] mx-auto mb-3" style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                    <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Queued...</p>
                  </div>
                </div>
              ) : record.status === 'generating' ? (
                <div className="group relative w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]" style={{ aspectRatio: aspectMap[record.aspectRatio] || '1/1' }}>
                  <GenerationImageActions onDelete={() => onDelete(record.id)} />
                  <div className="text-center">
                    <div className="w-3 h-3 bg-white mx-auto mb-3" style={{ animation: 'pulse-dot 1s ease-in-out infinite' }} />
                    <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Processing...</p>
                  </div>
                </div>
              ) : record.status === 'completed' && record.imageUrl ? (
                <div className="relative overflow-hidden group" style={{ aspectRatio: aspectMap[record.aspectRatio] || '1/1' }}>
                  <img src={record.imageUrl} alt={record.prompt} className="w-full h-full object-cover block" />
                  <GenerationImageActions
                    imageUrl={record.imageUrl}
                    downloadName={`${record.generationCode || record.pictureId || 'vision-image'}.png`}
                    isFavorite={record.isFavorite}
                    onToggleFavorite={() => onToggleFavorite(record.id)}
                    onDelete={() => onDelete(record.id)}
                    onEditImage={() => onEditImage(record.imageUrl!, record.prompt)}
                    onZoom={() => openLightbox(record.imageUrl!)}
                  />
                </div>
              ) : (
                <div className="group relative w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]" style={{ aspectRatio: aspectMap[record.aspectRatio] || '1/1' }}>
                  <GenerationImageActions
                    onDelete={() => onDelete(record.id)}
                    onRetryGenerate={() => onRetryGenerate(
                      record.prompt,
                      record.aspectRatio,
                      record.styleStrength,
                      record.engine,
                    )}
                  />
                  <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Failed</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox with keyboard navigation */}
      {lightboxIndex !== null && (
        <Lightbox
          images={completedImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}

function ProgressTrack({ record }: { record: GenerationRecord }) {
  const phase = resolveGenerationRecordProgressPhase(record);
  const track = buildGenerationProgressTrack(phase);
  const isActive = record.status === 'generating' || record.status === 'pending';
  const activeIdx = isActive
    ? track.findIndex(s => s.state !== 'complete' && s.state !== 'failed')
    : -1;

  return (
    <div className="mt-2 grid grid-cols-5 gap-2">
      {track.map((stage, idx) => (
        <div key={stage.key} className="space-y-2">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#1a1a1a]">
            <div
              className={`h-full transition-all duration-500 ${
                stage.state === 'complete'
                  ? 'bg-white'
                  : stage.state === 'failed'
                  ? 'bg-red-400'
                  : idx === activeIdx
                  ? 'progress-active-shimmer'
                  : 'bg-transparent'
              }`}
              style={{ width: stage.state === 'pending' && idx !== activeIdx ? '0%' : '100%' }}
            />
          </div>
          <p className={`text-[8px] font-mono-data uppercase tracking-[0.12em] leading-snug ${
            stage.state === 'complete'
              ? 'text-white'
              : stage.state === 'failed'
              ? 'text-red-300'
              : idx === activeIdx
              ? 'text-[#888]'
              : 'text-[#666]'
          }`}>
            {stage.label}
          </p>
        </div>
      ))}
    </div>
  );
}
