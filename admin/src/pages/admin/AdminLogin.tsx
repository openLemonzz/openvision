import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError('该账号没有管理后台权限');
        return;
      }

      navigate('/');
    } catch {
      setError('邮箱或密码错误');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8">
          <Shield size={28} className="text-white mx-auto mb-4" />
          <h1 className="text-[18px] font-normal text-white tracking-[0.1em] uppercase mb-1">
            VISION Admin
          </h1>
          <p className="text-[11px] text-[#666] font-mono-data tracking-wider">
            管理后台登录
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] text-[#888] uppercase tracking-[0.18em] mb-2 font-mono-data">
              管理员邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-transparent border border-[#333] text-white text-[13px] px-4 py-3 focus:border-white focus:outline-none transition-colors placeholder:text-[#444]"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[#888] uppercase tracking-[0.18em] mb-2 font-mono-data">
              账号密码
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-transparent border border-[#333] text-white text-[13px] px-4 py-3 focus:border-white focus:outline-none transition-colors placeholder:text-[#444]"
              placeholder="输入 Supabase 登录密码"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-[11px]">
              <AlertCircle size={12} />
              <span className="font-mono-data">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-white text-black text-[12px] font-medium uppercase tracking-[0.15em] py-3 hover:bg-[#e0e0e0] transition-colors disabled:opacity-50"
          >
            {submitting ? '验证中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-[11px] text-[#555] hover:text-[#888] transition-colors font-mono-data"
          >
            返回前台首页
          </a>
        </div>
      </div>
    </div>
  );
}
