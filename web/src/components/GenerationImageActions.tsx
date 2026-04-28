import { useState } from 'react';
import { Heart, Maximize2, MoreHorizontal, RefreshCcw, Trash2, Wand2, Download, Share2, Share, Check } from 'lucide-react';

import { toast } from 'sonner';
import { downloadImageFromUrl } from '../lib/image-actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from './ui/popover';

interface GenerationImageActionsProps {
  imageUrl?: string | null;
  downloadName?: string | null;
  isFavorite?: boolean;
  isShared?: boolean;
  onToggleFavorite?: () => void;
  onToggleShare?: () => void;
  onDelete?: () => void;
  onEditImage?: () => void;
  onRetryGenerate?: () => void;
  onZoom?: () => void;
}

export default function GenerationImageActions({
  imageUrl,
  downloadName,
  isFavorite = false,
  isShared = false,
  onToggleFavorite,
  onToggleShare,
  onDelete,
  onEditImage,
  onRetryGenerate,
  onZoom,
}: GenerationImageActionsProps) {
  const actionButtons = [
    imageUrl && onZoom ? (
      <button
        key="zoom"
        onClick={(event) => {
          event.stopPropagation();
          onZoom();
        }}
        className="bg-black/70 p-2 text-white transition-colors hover:bg-black"
        title="放大"
        aria-label="放大"
      >
        <Maximize2 size={14} />
      </button>
    ) : null,
    onToggleFavorite ? (
      <button
        key="favorite"
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        className="bg-black/70 p-2 text-red-400 transition-colors hover:bg-black hover:text-red-300"
        title={isFavorite ? '取消收藏' : '收藏'}
        aria-label={isFavorite ? '取消收藏' : '收藏'}
      >
        <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    ) : null,
    onRetryGenerate ? (
      <button
        key="retry"
        onClick={(event) => {
          event.stopPropagation();
          onRetryGenerate();
        }}
        className="bg-black/70 p-2 text-white transition-colors hover:bg-black"
        title="再次生成"
        aria-label="再次生成"
      >
        <RefreshCcw size={14} />
      </button>
    ) : null,
    onDelete ? (
      <Popover key="delete">
        <PopoverTrigger asChild>
          <button
            onClick={(event) => event.stopPropagation()}
            className="bg-black/70 p-2 text-white transition-colors hover:bg-black hover:text-red-300"
            title="删除"
            aria-label="删除"
          >
            <Trash2 size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          onClick={(event) => event.stopPropagation()}
          className="w-[190px] p-3"
        >
          <div className="space-y-3">
            <p className="text-[12px] font-medium text-white">确认删除？</p>
            <div className="flex items-center justify-end gap-2">
              <PopoverClose asChild>
                <button
                  type="button"
                  className="rounded-lg border border-white/12 bg-white/8 px-2.5 py-1.5 text-[11px] text-white transition-colors hover:border-white/20 hover:bg-white/12 hover:text-white"
                >
                  取消
                </button>
              </PopoverClose>
              <PopoverClose asChild>
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-lg border border-red-300/30 bg-red-400/18 px-2.5 py-1.5 text-[11px] text-red-50 transition-colors hover:bg-red-400/26 hover:text-white"
                >
                  删除
                </button>
              </PopoverClose>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    ) : null,
  ].filter(Boolean);

  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!imageUrl || isDownloading) {
      return;
    }

    setIsDownloading(true);
    const outcome = await downloadImageFromUrl(imageUrl, downloadName || 'vision-image.png');
    setIsDownloading(false);

    if (outcome === 'downloaded') {
      toast.success('已开始下载');
      return;
    }

    if (outcome === 'opened') {
      toast.info('已打开原图');
      return;
    }

    toast.error('下载失败');
  };

  const handleShare = async () => {
    // 优先使用系统分享
    if (navigator.share) {
      try {
        await navigator.share({ url: imageUrl ?? '' });
        return;
      } catch {
        // 用户取消分享，不做处理
        return;
      }
    }
    // 降级：复制链接
    await navigator.clipboard.writeText(imageUrl!);
    setShareState('copied');
    toast.success('已复制图片链接');
    setTimeout(() => setShareState('idle'), 2000);
  };

  return (
    <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      {actionButtons}

      {imageUrl ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(event) => event.stopPropagation()}
              className="bg-black/70 p-2 text-white transition-colors hover:bg-black"
              title="更多操作"
              aria-label="更多操作"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem
              disabled={isDownloading}
              onClick={() => void handleDownload()}
            >
              <Download size={13} />
              {isDownloading ? '下载中' : '下载'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void handleShare()}
            >
              {shareState === 'copied' ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
              {shareState === 'copied' ? '已复制链接' : '复制图片链接'}
            </DropdownMenuItem>
            {onToggleShare ? (
              <DropdownMenuItem onClick={onToggleShare}>
                <Share size={13} />
                {isShared ? '取消公开分享' : '公开分享(网页)'}
              </DropdownMenuItem>
            ) : null}
            {onEditImage ? (
              <DropdownMenuItem onClick={onEditImage}>
                <Wand2 size={13} />
                改图
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
