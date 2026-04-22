import { useState, useMemo } from 'react';
import { Search, Trash2, Image, Clock, Ratio, Zap, Mail } from 'lucide-react';
import type { GenerationRecord } from '@/hooks/useGeneration';
import type { AdminUser } from './AdminUsers';

interface AdminGenerationsProps {
  history: GenerationRecord[];
  users: AdminUser[];
  onDelete: (id: string) => void;
}

export default function AdminGenerations({ history, users, onDelete }: AdminGenerationsProps) {
  const getUserEmail = (userId?: string) => {
    if (!userId) return '—';
    const user = users.find(u => u.id === userId);
    return user?.email || userId.slice(0, 8);
  };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'generating' | 'failed'>('all');
  const [engineFilter, setEngineFilter] = useState<string>('all');

  const engines = useMemo(() => {
    const set = new Set(history.map(h => h.engine));
    return ['all', ...Array.from(set)];
  }, [history]);

  const filtered = useMemo(() => {
    return history.filter(h => {
      const matchesSearch = !search || h.prompt.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || h.status === statusFilter;
      const matchesEngine = engineFilter === 'all' || h.engine === engineFilter;
      return matchesSearch && matchesStatus && matchesEngine;
    });
  }, [history, search, statusFilter, engineFilter]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-[14px] font-normal text-white tracking-[0.08em]">生成记录</h2>
          <p className="text-[10px] text-[#666] font-mono-data mt-1">
            共 {history.length} 条记录
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索 prompt..."
            className="w-full bg-transparent border border-[#333] text-white text-[12px] pl-9 pr-4 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444]"
          />
        </div>
        <div className="flex gap-0">
          {(['all', 'completed', 'generating', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 text-[11px] font-mono-data tracking-wider border transition-all ${
                statusFilter === s
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-[#888] border-[#333] hover:border-[#555]'
              }`}
            >
              {s === 'all' ? '全部' : s === 'completed' ? '已完成' : s === 'generating' ? '生成中' : '失败'}
            </button>
          ))}
        </div>
        <select
          value={engineFilter}
          onChange={e => setEngineFilter(e.target.value)}
          className="bg-transparent border border-[#333] text-white text-[11px] px-3 py-2.5 focus:border-white focus:outline-none font-mono-data"
        >
          {engines.map(e => (
            <option key={e} value={e} className="bg-black">{e === 'all' ? '全部引擎' : e}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-[#222]">
        {/* Header */}
        <div className="hidden lg:grid lg:grid-cols-[60px_1fr_100px_80px_100px_120px_50px] gap-0 bg-[#111] border-b border-[#222]">
          {['图片', 'Prompt', '比例', '引擎', '强度', '时间', '操作'].map(h => (
            <div key={h} className="px-4 py-3 text-[9px] text-[#666] uppercase tracking-[0.15em] font-mono-data">
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-[11px] text-[#555] font-mono-data">
            没有找到匹配的记录
          </div>
        ) : (
          filtered.map(gen => (
            <div
              key={gen.id}
              className="lg:grid lg:grid-cols-[60px_1fr_100px_80px_100px_120px_50px] gap-0 border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors"
            >
              <div className="px-4 py-3 flex items-center">
                {gen.imageUrl ? (
                  <img src={gen.imageUrl} alt="" className="w-10 h-10 object-cover border border-[#333]" />
                ) : (
                  <div className="w-10 h-10 bg-[#1a1a1a] border border-[#333] flex items-center justify-center">
                    <Image size={14} className="text-[#444]" />
                  </div>
                )}
              </div>
              <div className="px-4 py-3 flex flex-col justify-center min-w-0">
                <p className="text-[11px] text-[#aaa] truncate">{gen.prompt}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[9px] text-[#444] font-mono-data truncate" title={gen.pictureId || '—'}>
                    pic: {gen.pictureId || '—'}
                  </span>
                  <span className="text-[9px] text-[#444] font-mono-data truncate" title={getUserEmail(gen.userId)}>
                    <Mail size={8} className="inline mr-0.5 text-[#555]" />
                    {getUserEmail(gen.userId)}
                  </span>
                </div>
              </div>
              <div className="px-4 py-3 flex items-center gap-1 text-[10px] text-[#888] font-mono-data">
                <Ratio size={10} className="text-[#555]" />
                {gen.aspectRatio}
              </div>
              <div className="px-4 py-3 flex items-center text-[10px] text-[#888] font-mono-data">
                <Zap size={10} className="text-[#555] mr-1" />
                {gen.engine}
              </div>
              <div className="px-4 py-3 flex items-center text-[10px] text-[#888] font-mono-data">
                {gen.styleStrength}%
              </div>
              <div className="px-4 py-3 flex items-center gap-1 text-[10px] text-[#666] font-mono-data">
                <Clock size={10} />
                {formatTime(gen.createdAt)}
              </div>
              <div className="px-4 py-3 flex items-center">
                <button
                  onClick={() => onDelete(gen.id)}
                  className="text-[#555] hover:text-red-400 transition-colors p-1"
                  title="删除"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
