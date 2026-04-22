import type { InitializationStatus } from '@/hooks/useInitialization';
import type { ResolvedRuntimeConfig } from '@/lib/runtime-config';
import { Spinner } from '@/components/ui/spinner';

interface InitializationScreenProps {
  status: InitializationStatus;
  runtimeConfig: ResolvedRuntimeConfig;
  onRetry: () => void;
}

function renderLabel(status: InitializationStatus) {
  switch (status.kind) {
    case 'config-missing':
      return '配置不完整';
    case 'backend-uninitialized':
    case 'network-error':
      return '服务启动中，请稍候…';
    case 'checking':
      return '初始化中…';
    default:
      return '加载中…';
  }
}

export default function InitializationScreen({
  status,
  onRetry,
}: InitializationScreenProps) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1
          className="text-[clamp(32px,6vw,64px)] leading-[0.95] tracking-[0.04em] uppercase"
          style={{ fontFamily: "'Geist Pixel', 'IBM Plex Mono', ui-monospace, monospace" }}
        >
          VISION
        </h1>

        <Spinner className="size-6 text-white/70" />

        <p className="text-[13px] tracking-[0.15em] text-[#A8A8A8]">
          {renderLabel(status)}
        </p>

        {status.kind !== 'checking' && (
          <button
            onClick={onRetry}
            className="mt-2 border border-[#333] bg-transparent px-5 py-2 text-[11px] uppercase tracking-[0.2em] text-[#888] transition-colors hover:text-white hover:border-[#555]"
          >
            重新加载
          </button>
        )}
      </div>
    </div>
  );
}
