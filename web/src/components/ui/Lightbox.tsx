import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface LightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export default function Lightbox({ images, currentIndex, onClose, onNavigate }: LightboxProps) {
  const src = images[currentIndex];
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < images.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && canPrev && onNavigate) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && canNext && onNavigate) onNavigate(currentIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, currentIndex, canPrev, canNext]);

  return (
    <div
      className="lightbox-backdrop-animate fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-8"
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-[#A8A8A8] hover:text-white transition-colors p-1"
        aria-label="关闭"
      >
        <X size={20} />
      </button>

      {/* 图片索引 */}
      {images.length > 1 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[11px] text-[#A8A8A8] font-mono-data tracking-[0.2em]">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* 图片主体，key 变化时重新触发入场动画 */}
      <img
        key={src}
        src={src}
        alt=""
        className="lightbox-image-animate max-w-full max-h-full object-contain"
        onClick={e => e.stopPropagation()}
      />

      {/* 左右导航 */}
      {images.length > 1 && onNavigate && (
        <>
          <button
            onClick={e => { e.stopPropagation(); if (canPrev) onNavigate(currentIndex - 1); }}
            disabled={!canPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8A8A8] hover:text-white transition-colors disabled:opacity-20 p-3"
            aria-label="上一张"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); if (canNext) onNavigate(currentIndex + 1); }}
            disabled={!canNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A8A8A8] hover:text-white transition-colors disabled:opacity-20 p-3"
            aria-label="下一张"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>
  );
}
