import { useState, useMemo } from 'react';
import { Search, UserCheck, UserX, Mail, Shield } from 'lucide-react';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'banned';
  role: 'user' | 'admin';
  createdAt: string;
  generationCount: number;
  inviteCount: number;
}

interface AdminUsersProps {
  users: AdminUser[];
  onToggleStatus: (id: string) => void;
}

export default function AdminUsers({ users, onToggleStatus }: AdminUsersProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = !search ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-[14px] font-normal text-white tracking-[0.08em]">用户管理</h2>
          <p className="text-[10px] text-[#666] font-mono-data mt-1">
            共 {users.length} 位用户
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索用户名或邮箱..."
            className="w-full bg-transparent border border-[#333] text-white text-[12px] pl-9 pr-4 py-2.5 focus:border-white focus:outline-none placeholder:text-[#444]"
          />
        </div>
        <div className="flex gap-0">
          {(['all', 'active', 'banned'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 text-[11px] font-mono-data tracking-wider border transition-all ${
                statusFilter === s
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-[#888] border-[#333] hover:border-[#555]'
              }`}
            >
              {s === 'all' ? '全部' : s === 'active' ? '正常' : '已禁用'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-[#222]">
        {/* Header */}
        <div className="hidden md:grid md:grid-cols-[1fr_1fr_100px_80px_100px_100px_60px] gap-0 bg-[#111] border-b border-[#222]">
          {['用户名', '邮箱', '状态', '角色', '生成数', '邀请数', '操作'].map(h => (
            <div key={h} className="px-4 py-3 text-[9px] text-[#666] uppercase tracking-[0.15em] font-mono-data">
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-[11px] text-[#555] font-mono-data">
            没有找到匹配的用户
          </div>
        ) : (
          filtered.map(user => (
            <div
              key={user.id}
              className="md:grid md:grid-cols-[1fr_1fr_100px_80px_100px_100px_60px] gap-0 border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors"
            >
              <div className="px-4 py-3 flex items-center gap-2">
                <span className="text-[12px] text-white">{user.username}</span>
              </div>
              <div className="px-4 py-3 flex items-center gap-2 text-[11px] text-[#aaa]">
                <Mail size={11} className="text-[#555] hidden sm:inline" />
                {user.email}
              </div>
              <div className="px-4 py-3 flex items-center">
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono-data px-2 py-0.5 border ${
                  user.status === 'active'
                    ? 'text-emerald-400 border-emerald-400/30'
                    : 'text-red-400 border-red-400/30'
                }`}>
                  {user.status === 'active' ? <UserCheck size={10} /> : <UserX size={10} />}
                  {user.status === 'active' ? '正常' : '禁用'}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center">
                <span className={`text-[10px] font-mono-data px-2 py-0.5 border ${
                  user.role === 'admin'
                    ? 'text-amber-400 border-amber-400/30'
                    : 'text-[#666] border-[#333]'
                }`}>
                  <Shield size={9} className="inline mr-1 -mt-0.5" />
                  {user.role === 'admin' ? '管理员' : '用户'}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center text-[11px] text-[#aaa] font-mono-data">
                {user.generationCount}
              </div>
              <div className="px-4 py-3 flex items-center text-[11px] text-[#aaa] font-mono-data">
                {user.inviteCount}
              </div>
              <div className="px-4 py-3 flex items-center">
                <button
                  onClick={() => onToggleStatus(user.id)}
                  className={`text-[10px] font-mono-data px-2 py-1 border transition-colors ${
                    user.status === 'active'
                      ? 'text-red-400 border-red-400/30 hover:bg-red-400/10'
                      : 'text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10'
                  }`}
                >
                  {user.status === 'active' ? '禁用' : '启用'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
