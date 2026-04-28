import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { Clock, Ratio, ChevronDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import CopyableMonoValue from './CopyableMonoValue';
import CopyPromptButton from './CopyPromptButton';
import GenerationImageActions from './GenerationImageActions';
import Lightbox from './ui/Lightbox';
import type { GenerationRecord } from '../hooks/useGeneration';
import {
  buildGenerationProgressTrack,
  findLatestCompletionRevealId,
  resolveGenerationRecordProgressPhase,
} from '../lib/utils';

interface HistoryStreamProps {
  records: GenerationRecord[];
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleShare?: (id: string) => void;
  onEditImage?: (imageUrl: string, prompt?: string) => void;
  onRetryGenerate?: (
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '3:4' | '9:16',
    styleStrength: number,
    engine: string,
  ) => void;
  lifecycleTick?: number;
  /** 是否启用折叠模式，首屏只显示第一条 */
  foldable?: boolean;
}

const aspectMap: Record<string, string> = {
  '1:1': '1/1',
  '16:9': '16/9',
  '3:4': '3/4',
  '9:16': '9/16',
};

function CinematicRevealImage({
  src,
  alt,
  aspectRatio,
  animate = false,
  actions,
}: {
  src: string;
  alt: string;
  aspectRatio: string;
  animate?: boolean;
  actions?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [revealed, setRevealed] = useState(!animate);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!animate) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 70);
    return () => clearTimeout(t);
  }, [animate, src]);

  const blockSize = 12;
  const steps = Math.ceil(width / blockSize);
  const duration = 0.6;
  const delay = 0.15;

  const revealStyles: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#000',
    backgroundSize: `${blockSize}px ${blockSize}px`,
    backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px), radial-gradient(circle, #fff 1px, transparent 1px)',
    backgroundPosition: '0 0, 6px 6px',
    animation: revealed ? `revealScan ${duration}s ${delay}s steps(${steps}, end) forwards` : 'none',
    transformOrigin: 'left',
    pointerEvents: 'none',
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden group" style={{ aspectRatio: aspectMap[aspectRatio] || '1/1' }}>
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover block transition-all duration-700 ease-out ${
          animate
            ? revealed
              ? 'opacity-100 blur-0 scale-100'
              : 'opacity-0 blur-md scale-[1.03]'
            : 'opacity-100 blur-0 scale-100'
        }`}
      />
      {/* ASCII overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }}
      />
      {actions}
      {animate ? <div style={revealStyles} /> : null}
    </div>
  );
}

/** 单条记录卡片，可被 foldable 区域复用 */
function RecordCard({
  record,
  animatedRecordIds,
  onDelete,
  onToggleFavorite,
  onToggleShare,
  onEditImage,
  onRetryGenerate,
  onZoom,
  formatTime,
}: {
  record: GenerationRecord;
  animatedRecordIds: Record<string, true>;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleShare?: (id: string) => void;
  onEditImage?: (imageUrl: string, prompt?: string) => void;
  onRetryGenerate?: (prompt: string, aspectRatio: '1:1' | '16:9' | '3:4' | '9:16', styleStrength: number, engine: string) => void;
  onZoom?: (url: string) => void;
  formatTime: (ts: number) => string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] border-t border-[#262626]">
      {/* Metadata panel */}
      <div className="p-5 flex flex-col justify-between border-r border-[#262626] min-h-[140px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Ratio size={11} className="text-[#4D4D4D]" />
              <span className="text-[11px] text-[#A8A8A8] font-mono-data">{record.aspectRatio}</span>
            </div>
            <div className="flex items-center gap-2 justify-end">
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
          <div
            className="group relative w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]"
            style={{ aspectRatio: aspectMap[record.aspectRatio] || '1/1' }}
          >
            {onDelete ? <GenerationImageActions onDelete={() => onDelete(record.id)} /> : null}
            <div className="text-center">
              <div className="w-3 h-3 bg-[#444] mx-auto mb-3" style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
              <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Queued...</p>
            </div>
          </div>
        ) : record.status === 'generating' ? (
          <div
            className="group relative w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]"
            style={{ aspectRatio: aspectMap[record.aspectRatio] || '1/1' }}
          >
            {onDelete ? <GenerationImageActions onDelete={() => onDelete(record.id)} /> : null}
            <div className="text-center">
              <div className="w-3 h-3 bg-white mx-auto mb-3" style={{ animation: 'pulse-dot 1s ease-in-out infinite' }} />
              <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Processing...</p>
            </div>
          </div>
        ) : record.status === 'completed' && record.imageUrl ? (
          <CinematicRevealImage
            src={record.imageUrl}
            alt={record.prompt}
            aspectRatio={record.aspectRatio}
            animate={Boolean(animatedRecordIds[record.id])}
            actions={
              <GenerationImageActions
                imageUrl={record.imageUrl}
                downloadName={`${record.generationCode || record.pictureId || 'vision-image'}.png`}
                isFavorite={record.isFavorite}
                isShared={record.isShared}
                onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(record.id) : undefined}
                onToggleShare={onToggleShare ? () => onToggleShare(record.id) : undefined}
                onDelete={onDelete ? () => onDelete(record.id) : undefined}
                onEditImage={onEditImage ? () => onEditImage(record.imageUrl!, record.prompt) : undefined}
                onZoom={onZoom ? () => onZoom(record.imageUrl!) : undefined}
              />
            }
          />
        ) : (
          <div
            className="group relative w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]"
            style={{ aspectRatio: '16/9' }}
          >
            {onDelete ? (
              <GenerationImageActions
                onDelete={() => onDelete(record.id)}
                onRetryGenerate={onRetryGenerate ? () => onRetryGenerate(
                  record.prompt,
                  record.aspectRatio,
                  record.styleStrength,
                  record.engine,
                ) : undefined}
              />
            ) : null}
            <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Failed</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryStream({
  records,
  onDelete,
  onToggleFavorite,
  onToggleShare,
  onEditImage,
  onRetryGenerate,
  lifecycleTick,
  foldable = false,
}: HistoryStreamProps) {
  void lifecycleTick;

  // Lightbox: track index into completed image list
  const completedImages = records
    .filter(r => r.status === 'completed' && r.imageUrl)
    .map(r => r.imageUrl!);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = useCallback((url: string) => {
    const idx = completedImages.indexOf(url);
    setLightboxIndex(idx >= 0 ? idx : null);
  }, [completedImages]);

  const [expanded, setExpanded] = useState(false);
  const [animatedRecordIds, setAnimatedRecordIds] = useState<Record<string, true>>({});
  const previousRecordsRef = useRef<GenerationRecord[]>(records);

  useEffect(() => {
    const revealId = findLatestCompletionRevealId(previousRecordsRef.current, records);
    if (revealId) {
      setAnimatedRecordIds((prev) => (prev[revealId] ? prev : { ...prev, [revealId]: true }));
    }
    previousRecordsRef.current = records;
  }, [records]);

  const formatTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  if (records.length === 0) {
    return (
      <div className="w-full max-w-[900px] mx-auto mt-20 mb-20 text-center">
        <p className="text-[#4D4D4D] text-[12px] uppercase tracking-[0.2em] font-mono-data">
          暂无生成记录 · 在上方输入你的第一个指令
        </p>
      </div>
    );
  }

  const firstRecord = records[0];
  const restRecords = records.slice(1);
  const hasMore = foldable && restRecords.length > 0;

  const commonProps = { animatedRecordIds, onDelete, onToggleFavorite, onToggleShare, onEditImage, onRetryGenerate, onZoom: openLightbox, formatTime };

  return (
    <div className="w-full max-w-[1100px] mx-auto mt-16 mb-20 px-6">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[11px] text-[#A8A8A8] uppercase tracking-[0.18em] font-mono-data">
          Timeline Stream · 生成记录
        </h3>
        <span className="text-[10px] text-[#4D4D4D] font-mono-data">
          {records.length} items
        </span>
      </div>

      <div className="space-y-0">
        {/* 始终可见的第一条 */}
        <RecordCard key={firstRecord.id} record={firstRecord} {...commonProps} />

        {/* 折叠展开区域 */}
        {hasMore && (
          <>
            {/* 折叠容器 (CSS grid-template-rows 动画) */}
            <div className={`fold-grid ${expanded ? 'fold-open' : ''}`}>
              <div className="fold-inner">
                {restRecords.map((record, idx) => (
                  <div
                    key={record.id}
                    style={expanded ? {
                      animation: `fold-record-in 380ms cubic-bezier(0.16,1,0.3,1) ${idx * 60}ms both`,
                    } : undefined}
                  >
                    <RecordCard record={record} {...commonProps} />
                  </div>
                ))}
              </div>
            </div>

            {/* 展开/收起按钮 + 查看全部 */}
            <div className="border-t border-[#262626] flex items-center justify-between py-3">
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-2 text-[11px] text-[#666] hover:text-white font-mono-data uppercase tracking-[0.14em] transition-colors group"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                />
                {expanded ? '收起' : `展开更多 · ${restRecords.length} 条`}
              </button>
              <Link
                to="/console/generations"
                className="flex items-center gap-1.5 text-[11px] text-[#666] hover:text-white font-mono-data uppercase tracking-[0.14em] transition-colors"
              >
                查看完整记录
                <ArrowRight size={12} />
              </Link>
            </div>
          </>
        )}

        {/* 非折叠模式但有记录时，也显示"查看全部"入口（仅当 foldable=false 且有内容时） */}
        {!foldable && records.length > 0 && (
          <div className="border-t border-[#262626] flex justify-end py-3">
            <Link
              to="/console/generations"
              className="flex items-center gap-1.5 text-[11px] text-[#666] hover:text-white font-mono-data uppercase tracking-[0.14em] transition-colors"
            >
              查看完整记录
              <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>

      {/* Lightbox */}
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
  // 当前正在处理的阶段 = 首个非 complete 且非 failed 的阶段（仅 active 状态下）
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
