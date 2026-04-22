import { useState } from 'react';
import { Copy, Check, Users, Gift, ArrowRight } from 'lucide-react';

interface InviteProps {
  isLoggedIn: boolean;
  inviteCode: string | null;
  inviteCount: number;
  onRequireAuth: () => void;
}

export default function Invite({ isLoggedIn, inviteCode, inviteCount, onRequireAuth }: InviteProps) {
  const [copied, setCopied] = useState(false);

  const inviteUrl = inviteCode
    ? `${window.location.origin}/?invite=${inviteCode}`
    : '';

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[800px]">
      <div className="mb-8">
        <h2 className="text-[14px] font-normal text-white tracking-[0.08em]">邀请计划</h2>
        <p className="text-[10px] text-[#666] font-mono-data mt-1">
          邀请好友加入 VISION，获得额外生成额度
        </p>
      </div>

      {!isLoggedIn ? (
        <div className="liquid-glass p-10 text-center">
          <Users size={32} className="text-[#4D4D4D] mx-auto mb-4" />
          <p className="text-[14px] text-[#A8A8A8] mb-6">
            登录后即可获取专属邀请链接
          </p>
          <button
            onClick={onRequireAuth}
            className="bg-white text-black text-[12px] uppercase tracking-[0.15em] px-8 py-3 hover:bg-[#E0E0E0] transition-colors font-mono-data inline-flex items-center gap-2"
          >
            登录账户
            <ArrowRight size={13} />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-0">
            <div className="border border-[#222] p-6">
              <p className="text-[10px] text-[#A8A8A8] uppercase tracking-[0.18em] font-mono-data mb-2">
                已邀请人数
              </p>
              <p className="text-[32px] text-white font-mono-data leading-none">
                {inviteCount}
              </p>
            </div>
            <div className="border border-[#222] border-l-0 p-6">
              <p className="text-[10px] text-[#A8A8A8] uppercase tracking-[0.18em] font-mono-data mb-2">
                获得奖励
              </p>
              <p className="text-[32px] text-white font-mono-data leading-none flex items-center gap-2">
                {inviteCount * 10}
                <Gift size={18} className="text-[#A8A8A8]" />
              </p>
            </div>
          </div>

          {/* Invite Code */}
          <div className="liquid-glass p-6">
            <p className="text-[10px] text-[#A8A8A8] uppercase tracking-[0.18em] font-mono-data mb-4">
              你的邀请链接
            </p>
            <div className="flex gap-0 mb-3">
              <div className="flex-1 bg-black/50 border border-[#262626] px-4 py-3 text-[12px] text-[#A8A8A8] font-mono-data truncate">
                {inviteUrl}
              </div>
              <button
                onClick={handleCopy}
                className="bg-white text-black px-5 py-3 hover:bg-[#E0E0E0] transition-colors flex items-center gap-2"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-[11px] uppercase tracking-wider font-mono-data">
                  {copied ? '已复制' : '复制'}
                </span>
              </button>
            </div>
            <p className="text-[10px] text-[#4D4D4D] font-mono-data">
              Invite Code: {inviteCode || '—'}
            </p>
          </div>

          {/* Rules */}
          <div className="border border-[#222] p-6">
            <p className="text-[10px] text-[#A8A8A8] uppercase tracking-[0.18em] font-mono-data mb-5">
              邀请规则
            </p>
            <div className="space-y-4">
              {[
                { step: '01', text: '复制你的专属邀请链接或邀请码' },
                { step: '02', text: '将链接发送给好友，好友通过链接注册' },
                { step: '03', text: '每成功邀请一位好友，双方各获得 10 次免费生成额度' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-4">
                  <span className="text-[11px] text-[#4D4D4D] font-mono-data mt-0.5">{item.step}</span>
                  <p className="text-[13px] text-[#A8A8A8] leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
