import { LogOut, User, Mail, Key, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ConsoleAccountProps {
  username: string | null;
  email: string | null;
  inviteCode: string | null;
  inviteCount: number;
  onLogout: () => void;
}

export default function ConsoleAccount({ username, email, inviteCode, inviteCount, onLogout }: ConsoleAccountProps) {
  const [copied, setCopied] = useState(false);

  const inviteUrl = inviteCode
    ? `${window.location.origin}/?invite=${inviteCode}`
    : '';

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[800px]">
      <h2 className="text-[14px] font-normal text-white tracking-[0.08em] mb-6">账户设置</h2>

      {/* Profile card */}
      <div className="border border-[#222] p-6 mb-4">
        <h3 className="text-[11px] text-[#888] uppercase tracking-[0.12em] font-mono-data mb-5">
          基本信息
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#222] flex items-center justify-center">
              <User size={18} className="text-[#888]" />
            </div>
            <div>
              <p className="text-[14px] text-white">{username || '未登录'}</p>
              <p className="text-[11px] text-[#666] font-mono-data flex items-center gap-1.5 mt-1">
                <Mail size={11} />
                {email || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Invite code */}
      <div className="border border-[#222] p-6 mb-4">
        <h3 className="text-[11px] text-[#888] uppercase tracking-[0.12em] font-mono-data mb-5">
          我的邀请码
        </h3>
        <div className="flex gap-0 mb-3">
          <div className="flex-1 bg-[#111] border border-[#333] px-4 py-3 text-[13px] text-white font-mono-data tracking-wider">
            {inviteCode || '—'}
          </div>
          <button
            onClick={handleCopy}
            disabled={!inviteCode}
            className="bg-white text-black px-4 hover:bg-[#e0e0e0] transition-colors disabled:opacity-30 flex items-center gap-2"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span className="text-[11px] uppercase tracking-wider font-mono-data">
              {copied ? '已复制' : '复制'}
            </span>
          </button>
        </div>
        <div className="flex gap-6 text-[11px] text-[#666] font-mono-data">
          <span>已邀请: {inviteCount} 人</span>
          <span>获得奖励: {inviteCount * 10} 次</span>
        </div>
      </div>

      {/* Security */}
      <div className="border border-[#222] p-6 mb-4">
        <h3 className="text-[11px] text-[#888] uppercase tracking-[0.12em] font-mono-data mb-5">
          安全
        </h3>
        <div className="flex items-center justify-between py-3 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <Key size={14} className="text-[#555]" />
            <div>
              <p className="text-[12px] text-white">修改密码</p>
              <p className="text-[10px] text-[#555] font-mono-data mt-0.5">定期更换密码保护账户安全</p>
            </div>
          </div>
          <button className="text-[10px] text-[#888] border border-[#333] px-3 py-1.5 hover:border-white hover:text-white transition-colors font-mono-data uppercase">
            修改
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 border border-red-400/30 text-red-400 px-5 py-3 text-[12px] uppercase tracking-[0.12em] font-mono-data hover:bg-red-400/10 transition-colors"
      >
        <LogOut size={14} />
        退出登录
      </button>
    </div>
  );
}
