import { useState, useEffect } from 'react';
import { Grid3X3, List } from 'lucide-react';
import CopyableMonoValue from '../components/CopyableMonoValue';
import GenerationImageActions from '../components/GenerationImageActions';
import type { GenerationRecord } from '../hooks/useGeneration';

interface GalleryProps {
  history: GenerationRecord[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEditImage: (imageUrl: string, prompt?: string) => void;
  lifecycleTick?: number;
}

const FILTER_OPTIONS = ['全部', '1:1', '16:9', '3:4', '9:16'];

export default function Gallery({ history, onDelete, onToggleFavorite, onEditImage }: GalleryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('全部');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
                className="w-full aspect-square object-contain bg-[#0D0D0D] block"
              />
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4">
                <GenerationImageActions
                  imageUrl={record.imageUrl}
                  downloadName={`${record.generationCode || record.pictureId || 'vision-image'}.png`}
                  isFavorite
                  onToggleFavorite={() => onToggleFavorite(record.id)}
                  onDelete={() => onDelete(record.id)}
                  onEditImage={() => onEditImage(record.imageUrl, record.prompt)}
                  onZoom={() => setSelectedImage(record.imageUrl)}
                />
                <div>
                  <p className="text-[10px] text-[#A8A8A8] font-mono-data mb-1">{record.aspectRatio}</p>
                  <div className="mb-1 flex flex-col gap-1">
                    <CopyableMonoValue prefix="gen" value={record.generationCode} />
                    <CopyableMonoValue prefix="pic" value={record.pictureId} />
                  </div>
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
              <div className="group relative">
                <img
                  src={record.imageUrl}
                  alt={record.prompt}
                  className="w-full aspect-square object-contain bg-[#0D0D0D] block border border-[#222]"
                />
                <GenerationImageActions
                  imageUrl={record.imageUrl}
                  downloadName={`${record.generationCode || record.pictureId || 'vision-image'}.png`}
                  isFavorite
                  onToggleFavorite={() => onToggleFavorite(record.id)}
                  onDelete={() => onDelete(record.id)}
                  onEditImage={() => onEditImage(record.imageUrl, record.prompt)}
                  onZoom={() => setSelectedImage(record.imageUrl)}
                />
              </div>
              <div>
                <p className="text-[12px] text-white leading-relaxed">{record.prompt}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-[10px] text-[#4D4D4D] font-mono-data">{record.aspectRatio}</span>
                  <span className="text-[10px] text-[#4D4D4D] font-mono-data">{record.engine}</span>
                  <CopyableMonoValue prefix="gen" value={record.generationCode} />
                  <CopyableMonoValue prefix="pic" value={record.pictureId} />
                </div>
              </div>
              <div />
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
