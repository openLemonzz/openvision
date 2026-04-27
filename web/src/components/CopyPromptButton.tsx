import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface CopyPromptButtonProps {
  value: string;
  className?: string;
}

export default function CopyPromptButton({ value, className = '' }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!value.trim()) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (!navigator.clipboard?.writeText) {
          toast.error('复制失败');
          return;
        }

        void navigator.clipboard.writeText(value)
          .then(() => {
            setCopied(true);
            toast.success('已复制 prompt');
          })
          .catch(() => toast.error('复制失败'));
      }}
      className={`shrink-0 p-1 text-[#555] transition-colors hover:text-white ${className}`}
      title="复制 prompt"
      aria-label="复制 prompt"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}
