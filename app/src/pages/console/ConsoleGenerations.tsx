import { useState, useCallback } from 'react';
import { Maximize2, Trash2, Clock, Ratio, Heart } from 'lucide-react';
import type { GenerationRecord } from '../../hooks/useGeneration';
import { calculateLifecycle } from '../../hooks/useGeneration';

interface ConsoleGenerationsProps {
  history: GenerationRecord[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  lifecycleTick?: number;
}

export default function ConsoleGenerations({ history, onDelete, onToggleFavorite, lifecycleTick }: ConsoleGenerationsProps) {
  void lifecycleTick;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
                <GenerationLifecycleBar record={record} />
              </div>

              <p className="text-[12px] text-[#A8A8A8] leading-relaxed mt-4 line-clamp-2">
                {record.prompt}
              </p>

              {hoveredId === record.id && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => onToggleFavorite(record.id)}
                    className={`transition-colors ${record.isFavorite ? 'text-red-400' : 'text-[#4D4D4D] hover:text-red-400'}`}
                    title={record.isFavorite ? '取消收藏' : '收藏'}
                  >
                    <Heart size={13} fill={record.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => onDelete(record.id)}
                    className="text-[#4D4D4D] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Image panel */}
            <div className="p-5">
              {record.status === 'pending' ? (
                <div className="w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]" style={{ aspectRatio: '16/9' }}>
                  <div className="text-center">
                    <div className="w-3 h-3 bg-[#444] mx-auto mb-3" style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                    <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Queued...</p>
                  </div>
                </div>
              ) : record.status === 'generating' ? (
                <div className="w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]" style={{ aspectRatio: '16/9' }}>
                  <div className="text-center">
                    <div className="w-3 h-3 bg-white mx-auto mb-3" style={{ animation: 'pulse-dot 1s ease-in-out infinite' }} />
                    <p className="text-[10px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">Processing...</p>
                  </div>
                </div>
              ) : record.status === 'completed' && record.imageUrl ? (
                <div className="relative overflow-hidden group" style={{ aspectRatio: '16/9' }}>
                  <img src={record.imageUrl} alt={record.prompt} className="w-full h-full object-cover block" />
                  <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <button className="bg-black/70 text-white p-2 hover:bg-black transition-colors" title="放大">
                      <Maximize2 size={14} />
                    </button>
                    <button
                      onClick={() => onToggleFavorite(record.id)}
                      className={`p-2 transition-colors ${record.isFavorite ? 'bg-red-500/70 text-white' : 'bg-black/70 text-white hover:bg-black'}`}
                      title={record.isFavorite ? '取消收藏' : '收藏'}
                    >
                      <Heart size={14} fill={record.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center justify-center bg-[#0D0D0D] border border-[#262626]" style={{ aspectRatio: '16/9' }}>
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

function GenerationLifecycleBar({ record }: { record: GenerationRecord }) {
  const info = calculateLifecycle(record);
  console.log(`[UI-ConsoleGen] render lifecycleBar record=${record.id.slice(0, 8)} status=${record.status} lifecycle=${info.lifecycle} progress=${info.progress.toFixed(1)}% text=${info.remainingText}`);
  if (!info.lifecycle) return null;

  const colorClass =
    info.lifecycle === 'expired' ? 'bg-red-500' :
    info.lifecycle === 'expiring' ? 'bg-amber-400' :
    info.lifecycle === 'generating' ? 'bg-white' :
    info.lifecycle === 'pending' ? 'bg-[#555]' :
    'bg-emerald-400';

  const textColor =
    info.lifecycle === 'expired' ? 'text-red-400' :
    info.lifecycle === 'expiring' ? 'text-amber-400' :
    info.lifecycle === 'generating' ? 'text-white' :
    info.lifecycle === 'pending' ? 'text-[#777]' :
    'text-emerald-400';

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[9px] font-mono-data ${textColor} uppercase tracking-wider`}>
          {info.lifecycle === 'expired' ? '已过期' : info.lifecycle === 'expiring' ? '即将过期' : info.lifecycle === 'generating' ? '生成中' : info.lifecycle === 'pending' ? '等待中' : '有效期'}
        </span>
        <span className={`text-[9px] font-mono-data ${textColor}`}>
          {info.remainingText}
        </span>
      </div>
      <div className="w-full h-[3px] bg-[#222] overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${info.progress}%` }} />
      </div>
    </div>
  );
}
