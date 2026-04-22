import { useState } from 'react';
import { Grid3X3, List, Trash2, Maximize2, Heart } from 'lucide-react';
import type { GenerationRecord } from '../hooks/useGeneration';

interface GalleryProps {
  history: GenerationRecord[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  lifecycleTick?: number;
}

const FILTER_OPTIONS = ['全部', '1:1', '16:9', '3:4', '9:16'];

export default function Gallery({ history, onDelete, onToggleFavorite }: GalleryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('全部');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const filtered = filter === '全部'
    ? history
    : history.filter(r => r.aspectRatio === filter);

  const favoriteRecords = filtered.filter(r => r.status === 'completed' && r.imageUrl);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-[14px] font-normal text-white tracking-[0.08em]">影像档案</h2>
          <p className="text-[10px] text-[#666] font-mono-data mt-1">
            {favoriteRecords.length} 收藏
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-[#333]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-white text-black' : 'text-[#A8A8A8] hover:text-white'}`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-white text-black' : 'text-[#A8A8A8] hover:text-white'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-0 mb-6">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-[11px] font-mono-data tracking-wider border transition-all ${
              filter === f
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-[#A8A8A8] border-[#333] hover:border-[#555]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {favoriteRecords.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[12px] text-[#4D4D4D] uppercase tracking-[0.2em] font-mono-data">
            暂无收藏影像 · 在生成记录中点击 ♡ 收藏
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {favoriteRecords.map(record => (
            <div
              key={record.id}
              className="group relative border border-[#222] overflow-hidden hover:border-[#4D4D4D] transition-colors cursor-pointer"
              onClick={() => setSelectedImage(record.imageUrl)}
            >
              <img
                src={record.imageUrl}
                alt={record.prompt}
                className="w-full aspect-square object-cover block"
              />
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedImage(record.imageUrl); }}
                    className="text-white hover:text-[#A8A8A8] transition-colors"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onToggleFavorite(record.id); }}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="取消收藏"
                  >
                    <Heart size={14} fill="currentColor" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(record.id); }}
                    className="text-white hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div>
                  <p className="text-[10px] text-[#A8A8A8] font-mono-data mb-1">{record.aspectRatio}</p>
                  <p className="text-[9px] text-[#444] font-mono-data mb-1 truncate">pic: {record.pictureId || '—'}</p>
                  <p className="text-[11px] text-white leading-snug line-clamp-3">{record.prompt}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-0">
          {favoriteRecords.map(record => (
            <div
              key={record.id}
              className="grid grid-cols-[100px_1fr_auto] gap-4 border-t border-[#222] py-4 items-center group hover:bg-white/[0.02] transition-colors"
            >
              <img
                src={record.imageUrl}
                alt={record.prompt}
                className="w-full aspect-square object-cover block border border-[#222]"
              />
              <div>
                <p className="text-[12px] text-white leading-relaxed">{record.prompt}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-[10px] text-[#4D4D4D] font-mono-data">{record.aspectRatio}</span>
                  <span className="text-[10px] text-[#4D4D4D] font-mono-data">{record.engine}</span>
                  <span className="text-[9px] text-[#444] font-mono-data truncate">pic: {record.pictureId || '—'}</span>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setSelectedImage(record.imageUrl)}
                  className="text-[#A8A8A8] hover:text-white transition-colors p-1"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={() => onToggleFavorite(record.id)}
                  className="text-red-400 hover:text-red-300 transition-colors p-1"
                  title="取消收藏"
                >
                  <Heart size={13} fill="currentColor" />
                </button>
                <button
                  onClick={() => onDelete(record.id)}
                  className="text-[#A8A8A8] hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-8"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 text-[#A8A8A8] hover:text-white text-[12px] uppercase tracking-[0.2em] font-mono-data"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
