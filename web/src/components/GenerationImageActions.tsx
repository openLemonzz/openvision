import { Heart, Maximize2, MoreHorizontal, RefreshCcw, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
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
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  onEditImage?: () => void;
  onRetryGenerate?: () => void;
  onZoom?: () => void;
}

function downloadImage(url: string, downloadName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export default function GenerationImageActions({
  imageUrl,
  downloadName,
  isFavorite = false,
  onToggleFavorite,
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
              onClick={() => {
                downloadImage(imageUrl, downloadName || 'vision-image.png');
              }}
            >
              下载
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(imageUrl);
                toast.success('已复制图片链接');
              }}
            >
              复制图片链接
            </DropdownMenuItem>
            {onEditImage ? (
              <DropdownMenuItem onClick={onEditImage}>
                <Wand2 size={14} />
                改图
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
