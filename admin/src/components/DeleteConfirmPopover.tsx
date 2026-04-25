import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteConfirmPopoverProps {
  onConfirm: () => void;
}

export default function DeleteConfirmPopover({ onConfirm }: DeleteConfirmPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-[#555] transition-colors hover:text-red-400 p-1"
        title="删除"
      >
        <Trash2 size={13} />
      </button>

      {open ? (
        <div className="liquid-glass-overlay-dark absolute right-0 top-[calc(100%+8px)] z-20 w-[190px] p-3">
          <div className="space-y-3">
            <p className="text-[12px] font-medium text-white">确认删除？</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/12 bg-white/8 px-2.5 py-1.5 text-[11px] text-white transition-colors hover:border-white/20 hover:bg-white/12 hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
                className="rounded-lg border border-red-300/30 bg-red-400/18 px-2.5 py-1.5 text-[11px] text-red-50 transition-colors hover:bg-red-400/26 hover:text-white"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
