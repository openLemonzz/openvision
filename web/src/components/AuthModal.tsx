import { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  visible: boolean;
  mode: 'login' | 'register';
  error: string;
  confirmation?: string;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (username: string, email: string, password: string, inviteCode?: string) => Promise<boolean>;
  onSwitchMode: () => void;
  onGoToLogin?: () => void;
  onResetPassword?: (email: string) => Promise<boolean>;
}

export default function AuthModal({ visible, mode, error, confirmation, onClose, onLogin, onRegister, onSwitchMode, onGoToLogin, onResetPassword }: AuthModalProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  // P1-3: 切换模式或重新打开弹窗时清空敏感字段，保留 email
  useEffect(() => {
    setPassword('');
    setUsername('');
    setInviteCode('');
    setSubmitting(false);
    setShowPassword(false);
    setLocalError('');
  }, [mode, visible]);

  if (!visible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(username, email, password, inviteCode || undefined);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setLocalError('请输入邮箱地址');
      return;
    }
    setLocalError('');
    if (!onResetPassword) return;
    setSubmitting(true);
    try {
      await onResetPassword(email.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="liquid-glass-strong relative w-full max-w-[420px] mx-4 p-10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#A8A8A8] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <h2 className="text-[22px] font-normal tracking-wide text-white mb-1 uppercase">
          {mode === 'login' ? '登录' : '注册'}
        </h2>
        <p className="text-[13px] text-[#A8A8A8] mb-8 font-mono-data">
          {mode === 'login' ? 'Welcome back to VISION' : 'Create your VISION account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] text-[#A8A8A8] uppercase tracking-widest mb-2 font-mono-data">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full bg-transparent border border-[#262626] text-white text-[14px] px-4 py-3 focus:border-white focus:outline-none transition-colors placeholder:text-[#4D4D4D]"
                placeholder="输入用户名"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] text-[#A8A8A8] uppercase tracking-widest mb-2 font-mono-data">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-transparent border border-[#262626] text-white text-[14px] px-4 py-3 focus:border-white focus:outline-none transition-colors placeholder:text-[#4D4D4D]"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#A8A8A8] uppercase tracking-widest mb-2 font-mono-data">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-transparent border border-[#262626] text-white text-[14px] px-4 py-3 pr-10 focus:border-white focus:outline-none transition-colors placeholder:text-[#4D4D4D]"
                placeholder="至少6位字符"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={submitting}
                className="text-[11px] text-[#A8A8A8] hover:text-white transition-colors font-mono-data disabled:opacity-40"
              >
                忘记密码？
              </button>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-[11px] text-[#A8A8A8] uppercase tracking-widest mb-2 font-mono-data">
                Invite Code (optional)
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                className="w-full bg-transparent border border-[#262626] text-white text-[14px] px-4 py-3 focus:border-white focus:outline-none transition-colors placeholder:text-[#4D4D4D] font-mono-data"
                placeholder="XXXX-XXXX"
              />
            </div>
          )}

          {(error || localError) && (
            <p className="text-[12px] text-red-400 font-mono-data">{error || localError}</p>
          )}

          {confirmation && (
            <p className="text-[12px] text-emerald-400 font-mono-data leading-relaxed">{confirmation}</p>
          )}

          {confirmation ? (
            <button
              type="button"
              onClick={onGoToLogin}
              className="w-full bg-white text-black text-[13px] font-medium uppercase tracking-widest py-3.5 hover:bg-[#E0E0E0] transition-colors mt-2"
            >
              前往登录
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-white text-black text-[13px] font-medium uppercase tracking-widest py-3.5 hover:bg-[#E0E0E0] transition-colors mt-2 disabled:opacity-50"
            >
              {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          )}
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onSwitchMode}
            className="text-[12px] text-[#A8A8A8] hover:text-white transition-colors font-mono-data border-b border-transparent hover:border-white pb-0.5"
          >
            {mode === 'login' ? '没有账户？注册' : '已有账户？登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
