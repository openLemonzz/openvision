import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, UserX, Mail, Shield, Trash2 } from 'lucide-react';
import type { AdminUser } from '@/lib/types';

export type { AdminUser } from '@/lib/types';

interface AdminUsersProps {
  users: AdminUser[];
  onToggleStatus: (id: string) => void;
  onUpdateUserSettings: (id: string, concurrencyLimit: number) => Promise<{ id: string; concurrencyLimit: number }>;
  onDeleteUser: (id: string) => Promise<void>;
  currentAdminId?: string;
}

export default function AdminUsers({
  users,
  onToggleStatus,
  onUpdateUserSettings,
  onDeleteUser,
  currentAdminId,
}: AdminUsersProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned' | 'pending'>('all');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [concurrencyDrafts, setConcurrencyDrafts] = useState<Record<string, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    setConcurrencyDrafts(
      Object.fromEntries(users.map((user) => [user.id, String(user.concurrencyLimit)]))
    );
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = !search ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDeleteUser(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveConcurrency = async (user: AdminUser) => {
    const rawValue = concurrencyDrafts[user.id] ?? String(user.concurrencyLimit);
    const parsedValue = Number(rawValue);

    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      setSaveErrors((prev) => ({ ...prev, [user.id]: '请输入大于等于 1 的整数' }));
      return;
    }

    setSavingUserId(user.id);
    setSaveErrors((prev) => ({ ...prev, [user.id]: '' }));
    try {
      await onUpdateUserSettings(user.id, parsedValue);
    } catch (error) {
      setSaveErrors((prev) => ({
        ...prev,
        [user.id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setSavingUserId(null);
    }
  };

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
          {(['all', 'active', 'banned', 'pending'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 text-[11px] font-mono-data tracking-wider border transition-all ${
                statusFilter === s
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-[#888] border-[#333] hover:border-[#555]'
              }`}
            >
              {s === 'all' ? '全部' : s === 'active' ? '正常' : s === 'banned' ? '已禁用' : '待确认'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-[#222]">
        {/* Header */}
        <div className="hidden md:grid md:grid-cols-[1fr_1fr_100px_80px_120px_100px_100px_140px] gap-0 bg-[#111] border-b border-[#222]">
          {['用户名', '邮箱', '状态', '角色', '并发数', '生成数', '邀请数', '操作'].map(h => (
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
              className="md:grid md:grid-cols-[1fr_1fr_100px_80px_120px_100px_100px_140px] gap-0 border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors"
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
                    : user.status === 'pending'
                    ? 'text-amber-400 border-amber-400/30'
                    : 'text-red-400 border-red-400/30'
                }`}>
                  {user.status === 'active' ? <UserCheck size={10} /> : user.status === 'pending' ? <Mail size={10} /> : <UserX size={10} />}
                  {user.status === 'active' ? '正常' : user.status === 'pending' ? '待确认' : '禁用'}
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
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={concurrencyDrafts[user.id] ?? String(user.concurrencyLimit)}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setConcurrencyDrafts((prev) => ({ ...prev, [user.id]: nextValue }));
                      if (saveErrors[user.id]) {
                        setSaveErrors((prev) => ({ ...prev, [user.id]: '' }));
                      }
                    }}
                    className="w-[64px] bg-transparent border border-[#333] px-2 py-1 text-[11px] text-white font-mono-data focus:border-white focus:outline-none"
                  />
                  <button
                    onClick={() => void handleSaveConcurrency(user)}
                    disabled={savingUserId === user.id}
                    className="text-[10px] font-mono-data px-2 py-1 border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] transition-colors disabled:opacity-50"
                  >
                    {savingUserId === user.id ? '保存中' : '保存'}
                  </button>
                </div>
                {saveErrors[user.id] ? (
                  <p className="mt-1 text-[10px] text-red-400 font-mono-data leading-snug">
                    {saveErrors[user.id]}
                  </p>
                ) : null}
              </div>
              <div className="px-4 py-3 flex items-center text-[11px] text-[#aaa] font-mono-data">
                {user.generationCount}
              </div>
              <div className="px-4 py-3 flex items-center text-[11px] text-[#aaa] font-mono-data">
                {user.inviteCount}
              </div>
              <div className="px-4 py-3 flex items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleStatus(user.id)}
                    className={`text-[10px] font-mono-data px-2 py-1 border transition-colors ${
                      user.status === 'banned'
                        ? 'text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10'
                        : 'text-red-400 border-red-400/30 hover:bg-red-400/10'
                    }`}
                  >
                    {user.status === 'banned' ? '启用' : '禁用'}
                  </button>
                  {user.id !== currentAdminId && (
                    <button
                      onClick={() => {
                        setDeleteError('');
                        setDeleteTarget(user);
                      }}
                      className="text-red-400 border border-red-400/30 px-2 py-1 hover:bg-red-400/10 transition-colors"
                      title="删除用户"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-[520px] border border-red-400/20 bg-[#0f0f0f] p-6 shadow-2xl">
            <h3 className="text-[14px] text-white tracking-[0.08em] mb-3">
              确认删除用户「{deleteTarget.username}」？
            </h3>
            <p className="text-[12px] text-[#a8a8a8] leading-relaxed mb-2">
              该用户有 {deleteTarget.generationCount} 条生成记录、{deleteTarget.inviteCount} 个被邀请人。
            </p>
            <p className="text-[12px] text-red-400 leading-relaxed mb-5">
              该操作会删除用户认证记录，并清理大部分关联数据，不可恢复。
            </p>
            {deleteError && (
              <p className="text-[12px] text-red-400 font-mono-data mb-4 break-words">
                {deleteError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  if (isDeleting) return;
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                className="text-[11px] font-mono-data px-4 py-2 border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
                className="text-[11px] font-mono-data px-4 py-2 border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
