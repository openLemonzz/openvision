import type { InitializationStatus } from '@/hooks/useInitialization';
import type { ResolvedRuntimeConfig } from '@/lib/runtime-config';

interface InitializationScreenProps {
  status: InitializationStatus;
  runtimeConfig: ResolvedRuntimeConfig;
  onRetry: () => void;
}

function renderTitle(status: InitializationStatus) {
  switch (status.kind) {
    case 'config-missing':
      return '运行时配置未完成';
    case 'functions-missing':
      return 'Edge Functions 尚未部署';
    case 'backend-uninitialized':
      return 'Supabase 资源尚未初始化';
    case 'network-error':
      return '无法连接 Supabase';
    case 'checking':
      return '正在检测初始化状态';
    default:
      return 'VISION';
  }
}

function renderDescription(status: InitializationStatus) {
  switch (status.kind) {
    case 'config-missing':
      return 'Docker 容器已经启动，但浏览器端缺少连接外部 Supabase 所需的运行时变量。';
    case 'functions-missing':
      return '前端变量已注入，但后端 Edge Functions 还未部署完整，业务页面暂时不会开放。';
    case 'backend-uninitialized':
      return 'Edge Functions 已可访问，但数据库 schema、storage bucket 或服务端环境还未准备好。';
    case 'network-error':
      return '当前无法访问配置的 Supabase 项目，请先确认 URL、网络和 CORS。';
    case 'checking':
      return '系统会自动轮询后端资源，一旦完成初始化会自动切换到业务页面。';
    default:
      return status.message;
  }
}

export default function InitializationScreen({
  status,
  runtimeConfig,
  onRetry,
}: InitializationScreenProps) {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl items-center justify-center">
        <div className="liquid-glass w-full max-w-3xl p-8 lg:p-10">
          <p className="mb-4 text-[10px] uppercase tracking-[0.35em] text-[#A8A8A8] font-mono-data">
            Docker Runtime Bootstrap
          </p>
          <h1
            className="text-[clamp(28px,5vw,54px)] leading-[0.95] tracking-[0.04em] uppercase"
            style={{ fontFamily: "'Geist Pixel', 'IBM Plex Mono', ui-monospace, monospace" }}
          >
            {renderTitle(status)}
          </h1>
          <p className="mt-4 text-[13px] leading-6 text-[#B8B8B8]">
            {renderDescription(status)}
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="border border-[#262626] bg-black/30 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#7A7A7A] font-mono-data">
                Runtime
              </p>
              <p className="mt-3 text-[12px] font-mono-data text-white">
                mode={runtimeConfig.runtime}
              </p>
              <p className="mt-2 text-[12px] font-mono-data break-all text-[#A8A8A8]">
                url={runtimeConfig.supabaseUrl || '(missing)'}
              </p>
            </div>

            <div className="border border-[#262626] bg-black/30 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#7A7A7A] font-mono-data">
                Next Action
              </p>
              <div className="mt-3 text-[12px] leading-6 text-[#D6D6D6]">
                <p>Docker 运行时缺变量时：补齐 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。</p>
                <p>后端未初始化时：运行 `docker compose up init` 或本地执行 `npm run deploy:supabase:init`。</p>
              </div>
            </div>
          </div>

          {status.kind === 'config-missing' && (
            <div className="mt-6 border border-[#3A2323] bg-[#170B0B] p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#FF8A8A] font-mono-data">
                Missing Variables
              </p>
              <div className="mt-3 space-y-1 text-[13px] text-[#FFD6D6]">
                {status.missingKeys.map((key) => (
                  <p key={key}>{key}</p>
                ))}
              </div>
            </div>
          )}

          {status.kind === 'functions-missing' && (
            <div className="mt-6 border border-[#3A2F18] bg-[#151007] p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#E6C36A] font-mono-data">
                Missing Functions
              </p>
              <div className="mt-3 space-y-1 text-[13px] text-[#F4E3B2]">
                {status.missingFunctions.map((name) => (
                  <p key={name}>{name}</p>
                ))}
              </div>
            </div>
          )}

          {status.kind === 'backend-uninitialized' && status.missingResources.length > 0 && (
            <div className="mt-6 border border-[#22313F] bg-[#0B1218] p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#8AC7FF] font-mono-data">
                Missing Resources
              </p>
              <div className="mt-3 space-y-1 text-[13px] text-[#D1EAFF]">
                {status.missingResources.map((resource) => (
                  <p key={resource}>{resource}</p>
                ))}
              </div>
            </div>
          )}

          {status.kind === 'network-error' && (
            <div className="mt-6 border border-[#3A2323] bg-[#170B0B] p-4 text-[13px] leading-6 text-[#FFD6D6]">
              <p>{status.message}</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={onRetry}
              disabled={status.kind === 'checking'}
              className="border border-[#262626] bg-white px-5 py-3 text-[11px] uppercase tracking-[0.22em] text-black transition-colors hover:bg-[#E6E6E6] disabled:cursor-not-allowed disabled:opacity-50 font-mono-data"
            >
              {status.kind === 'checking' ? '检测中' : '重新检测'}
            </button>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6F6F6F] font-mono-data">
              未就绪时每 5 秒会自动重试一次
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
