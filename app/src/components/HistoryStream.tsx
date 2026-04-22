import { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize2, Shuffle, Trash2, Clock, Ratio, Hourglass } from 'lucide-react';
import type { GenerationRecord } from '../hooks/useGeneration';
import { calculateLifecycle } from '../hooks/useGeneration';

interface HistoryStreamProps {
  records: GenerationRecord[];
  onDelete?: (id: string) => void;
  lifecycleTick?: number;
}

function CinematicRevealImage({ src, alt, aspectRatio }: { src: string; alt: string; aspectRatio: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [revealed, setRevealed] = useState(false);

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
    const t = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(t);
  }, []);

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

  const aspectMap: Record<string, string> = {
    '1:1': '1/1',
    '16:9': '16/9',
    '3:4': '3/4',
    '9:16': '9/16',
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden group" style={{ aspectRatio: aspectMap[aspectRatio] || '1/1' }}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover block"
      />
      {/* ASCII overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }}
      />
      {/* Action buttons on hover */}
      <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="bg-black/70 text-white p-2 hover:bg-black transition-colors" title="放大">
          <Maximize2 size={14} />
        </button>
        <button className="bg-black/70 text-white p-2 hover:bg-black transition-colors" title="重混">
          <Shuffle size={14} />
        </button>
      </div>
      {/* Cinematic reveal layer */}
      <div style={revealStyles} />
    </div>
  );
}

export default function HistoryStream({ records, onDelete, lifecycleTick }: HistoryStreamProps) {
  void lifecycleTick;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
        {records.map((record) => (
          <div
            key={record.id}
            className="grid grid-cols-1 md:grid-cols-[280px_1fr] border-t border-[#262626]"
            onMouseEnter={() => setHoveredId(record.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Metadata panel */}
            <div className="p-5 flex flex-col justify-between border-r border-[#262626] min-h-[140px]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Ratio size={11} className="text-[#4D4D4D]" />
                  <span className="text-[11px] text-[#A8A8A8] font-mono-data">{record.aspectRatio}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={11} className="text-[#4D4D4D]" />
                  <span className="text-[11px] text-[#A8A8A8] font-mono-data">{formatTime(record.createdAt)}</span>
                </div>
                <div className="text-[10px] text-[#4D4D4D] font-mono-data uppercase tracking-wider">
                  {record.engine}
                </div>
                <div className="text-[10px] text-[#4D4D4D] font-mono-data">
                  strength: {record.styleStrength}%
                </div>
                <div className="text-[9px] text-[#444] font-mono-data truncate" title={record.pictureId || '—'}>
                  pic: {record.pictureId || '—'}
                </div>
                <LifecycleBar record={record} />
              </div>

              {/* Prompt text */}
              <p className="text-[12px] text-[#A8A8A8] leading-relaxed mt-4 line-clamp-2">
                {record.prompt}
              </p>

              {/* Delete button */}
              {hoveredId === record.id && onDelete && (
                <button
                  onClick={() => onDelete(record.id)}
                  className="mt-3 text-[#4D4D4D] hover:text-red-400 transition-colors self-start"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Image panel */}
            <div className="p-5">
              {record.status === 'pending' ? (
                <div
                  className="w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]"
                  style={{ aspectRatio: '16/9' }}
                >
                  <div className="text-center">
                    <div
                      className="w-3 h-3 bg-[#444] mx-auto mb-3"
                      style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }}
                    />
                    <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">
                      Queued...
                    </p>
                  </div>
                </div>
              ) : record.status === 'generating' ? (
                <div
                  className="w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]"
                  style={{ aspectRatio: '16/9' }}
                >
                  <div className="text-center">
                    <div
                      className="w-3 h-3 bg-white mx-auto mb-3"
                      style={{ animation: 'pulse-dot 1s ease-in-out infinite' }}
                    />
                    <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">
                      Processing...
                    </p>
                  </div>
                </div>
              ) : record.status === 'completed' && record.imageUrl ? (
                <CinematicRevealImage
                  src={record.imageUrl}
                  alt={record.prompt}
                  aspectRatio={record.aspectRatio}
                />
              ) : (
                <div
                  className="w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]"
                  style={{ aspectRatio: '16/9' }}
                >
                  <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Failed</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LifecycleBar({ record }: { record: GenerationRecord }) {
  const info = calculateLifecycle(record);
  console.log(`[UI-HistoryStream] render lifecycleBar record=${record.id.slice(0, 8)} status=${record.status} lifecycle=${info.lifecycle} progress=${info.progress.toFixed(1)}% text=${info.remainingText}`);
  if (!info.lifecycle) return null;

  const colorClass =
    info.lifecycle === 'expired'
      ? 'bg-red-500'
      : info.lifecycle === 'expiring'
      ? 'bg-amber-400'
      : info.lifecycle === 'generating'
      ? 'bg-white'
      : info.lifecycle === 'pending'
      ? 'bg-[#555]'
      : 'bg-emerald-400';

  const textColor =
    info.lifecycle === 'expired'
      ? 'text-red-400'
      : info.lifecycle === 'expiring'
      ? 'text-amber-400'
      : info.lifecycle === 'generating'
      ? 'text-white'
      : info.lifecycle === 'pending'
      ? 'text-[#777]'
      : 'text-emerald-400';

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Hourglass size={9} className={textColor} />
          <span className={`text-[9px] font-mono-data ${textColor} uppercase tracking-wider`}>
            {info.lifecycle === 'expired' ? '已过期' : info.lifecycle === 'expiring' ? '即将过期' : info.lifecycle === 'generating' ? '生成中' : info.lifecycle === 'pending' ? '等待中' : '有效期'}
          </span>
        </div>
        <span className={`text-[9px] font-mono-data ${textColor}`}>
          {info.remainingText}
        </span>
      </div>
      <div className="w-full h-[3px] bg-[#222] overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${info.progress}%` }}
        />
      </div>
    </div>
  );
}
