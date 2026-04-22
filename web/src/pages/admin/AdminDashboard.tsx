import { useMemo } from 'react';
import { Users, Image, Zap, TrendingUp, Activity } from 'lucide-react';
import type { GenerationRecord } from '@/hooks/useGeneration';

interface DashboardProps {
  userCount: number;
  generationCount: number;
  history: GenerationRecord[];
}

export default function AdminDashboard({ userCount, generationCount, history }: DashboardProps) {
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = history.filter(h => h.createdAt >= today.getTime()).length;
    const completedCount = history.filter(h => h.status === 'completed').length;
    const pendingCount = history.filter(h => h.status === 'generating' || h.status === 'pending').length;
    return { todayCount, completedCount, pendingCount };
  }, [history]);

  const cards = [
    { label: '注册用户', value: userCount, icon: Users, color: 'text-white' },
    { label: '总生成数', value: generationCount, icon: Image, color: 'text-white' },
    { label: '今日生成', value: stats.todayCount, icon: TrendingUp, color: 'text-emerald-400' },
    { label: '已完成', value: stats.completedCount, icon: Zap, color: 'text-blue-400' },
  ];

  const recentGenerations = history.slice(0, 8);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <h2 className="text-[14px] font-normal text-white tracking-[0.08em] mb-6">
        数据概览
      </h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="border border-[#222] bg-[#111] p-5">
              <div className="flex items-center justify-between mb-3">
                <Icon size={14} className="text-[#555]" />
                <Activity size={12} className="text-[#333]" />
              </div>
              <p className="text-[24px] font-mono-data leading-none mb-2">{card.value}</p>
              <p className="text-[10px] text-[#666] uppercase tracking-[0.15em] font-mono-data">
                {card.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent generations */}
        <div className="border border-[#222]">
          <div className="px-5 py-3 border-b border-[#222] flex items-center justify-between">
            <h3 className="text-[11px] text-[#888] uppercase tracking-[0.12em] font-mono-data">
              最近生成
            </h3>
            <span className="text-[10px] text-[#444] font-mono-data">{history.length} total</span>
          </div>
          <div className="divide-y divide-[#1a1a1a]">
            {recentGenerations.length === 0 ? (
              <p className="text-[11px] text-[#444] px-5 py-8 text-center font-mono-data">
                暂无生成记录
              </p>
            ) : (
              recentGenerations.map(gen => (
                <div key={gen.id} className="px-5 py-3 flex items-center gap-4">
                  {gen.imageUrl ? (
                    <img src={gen.imageUrl} alt="" className="w-10 h-10 object-cover border border-[#333]" />
                  ) : (
                    <div className="w-10 h-10 bg-[#1a1a1a] border border-[#333]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#aaa] truncate">{gen.prompt}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[9px] text-[#555] font-mono-data">{gen.aspectRatio}</span>
                      <span className="text-[9px] text-[#555] font-mono-data">{gen.engine}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-mono-data px-1.5 py-0.5 border ${
                    gen.status === 'completed'
                      ? 'text-emerald-400 border-emerald-400/30'
                      : gen.status === 'generating'
                      ? 'text-amber-400 border-amber-400/30'
                      : 'text-[#555] border-[#333]'
                  }`}>
                    {gen.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Engine usage */}
        <div className="border border-[#222]">
          <div className="px-5 py-3 border-b border-[#222]">
            <h3 className="text-[11px] text-[#888] uppercase tracking-[0.12em] font-mono-data">
              引擎使用分布
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {['DALL-E 3', 'Midjourney V6', 'Stable Diffusion XL', 'Flux Pro'].map(engine => {
              const count = history.filter(h => h.engine === engine).length;
              const pct = history.length > 0 ? (count / history.length) * 100 : 0;
              return (
                <div key={engine}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[11px] text-[#aaa]">{engine}</span>
                    <span className="text-[10px] text-[#666] font-mono-data">{count}</span>
                  </div>
                  <div className="h-[3px] bg-[#1a1a1a]">
                    <div
                      className="h-full bg-white transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
