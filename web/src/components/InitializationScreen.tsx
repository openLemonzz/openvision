import type { InitializationStatus } from '@/hooks/useInitialization';
import type { ResolvedRuntimeConfig } from '@/lib/runtime-config';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface InitializationScreenProps {
  status: InitializationStatus;
  runtimeConfig: ResolvedRuntimeConfig;
  onRetry: () => void;
  overlay?: boolean;
  exiting?: boolean;
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
    case 'ready':
      return '系统就绪，正在进入影境…';
    default:
      return '加载中…';
  }
}

function renderHint(status: InitializationStatus) {
  switch (status.kind) {
    case 'config-missing':
      return '检查运行时环境变量与后端地址配置。';
    case 'backend-uninitialized':
      return '正在等待数据库与管理接口完成初始化。';
    case 'network-error':
      return '当前无法连接服务，稍后可重新触发探测。';
    case 'ready':
      return '首访过渡结束后将直接进入首页。';
    default:
      return '正在同步运行时配置与后端健康状态。';
  }
}

export default function InitializationScreen({
  status,
  onRetry,
  overlay = false,
  exiting = false,
}: InitializationScreenProps) {
  return (
    <div
      className={cn(
        'overflow-hidden bg-black text-white flex items-center justify-center transition-[opacity,filter,transform]',
        overlay ? 'fixed inset-0 z-[60]' : 'min-h-screen',
        exiting ? 'pointer-events-none opacity-0 blur-md scale-[1.03]' : 'opacity-100'
      )}
      style={{
        transitionDuration: '900ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14)_0%,transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0)_48%,rgba(0,0,0,0.78)_100%)]"
      />
      <div aria-hidden="true" className="vision-intro-grid pointer-events-none absolute inset-0 opacity-30" />
      <div aria-hidden="true" className="vision-intro-scanlines pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.45em] text-white/45 font-mono-data">
          System Gate
        </p>
        <h1
          className="vision-intro-mark text-[clamp(44px,9vw,112px)] leading-[0.88] tracking-[0.18em] uppercase"
          data-text="VISION"
          style={{ fontFamily: "'Geist Pixel', 'IBM Plex Mono', ui-monospace, monospace" }}
        >
          VISION
        </h1>

        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-white/75 animate-[pulse-dot_1.2s_ease-in-out_infinite]" />
          <p className="text-[12px] uppercase tracking-[0.3em] text-white/72 font-mono-data">
            {renderLabel(status)}
          </p>
        </div>

        <Spinner className="size-6 text-white/55" />

        <p className="max-w-[28rem] text-[11px] uppercase tracking-[0.22em] text-white/28 font-mono-data">
          {renderHint(status)}
        </p>

        {status.kind !== 'checking' && status.kind !== 'ready' && (
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
