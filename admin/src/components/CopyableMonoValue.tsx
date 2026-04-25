import { useEffect, useState } from 'react';

interface CopyableMonoValueProps {
  prefix: string;
  value: string | null | undefined;
}

export default function CopyableMonoValue({ prefix, value }: CopyableMonoValueProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!value) {
    return (
      <span className="text-[9px] text-[#444] font-mono-data truncate">
        {prefix}: —
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard.writeText(value);
        setCopied(true);
      }}
      className="text-[9px] text-[#444] font-mono-data truncate transition-colors hover:text-white"
      title={value}
    >
      {copied ? `${prefix}: copied` : `${prefix}: ${value}`}
    </button>
  );
}
