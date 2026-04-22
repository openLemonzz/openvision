import { Link, useLocation } from 'react-router-dom';
import { LogOut, User, Settings } from 'lucide-react';

interface NavigationProps {
  username: string | null;
  isLoggedIn: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => void;
}

export default function Navigation({ username, isLoggedIn, onLogin, onRegister, onLogout }: NavigationProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] liquid-glass h-[56px] flex items-center justify-between px-6 lg:px-10">
      <Link to="/" className="text-[16px] font-normal text-white tracking-[0.15em] uppercase select-none">
        VISION
      </Link>

      <div className="flex items-center gap-6">
        <Link
          to="/"
          className={`text-[11px] uppercase tracking-[0.12em] transition-colors font-mono-data ${
            isHome ? 'text-white' : 'text-[#A8A8A8] hover:text-white'
          }`}
        >
          工坊
        </Link>

        {isLoggedIn ? (
          <Link
            to="/console"
            className={`text-[11px] uppercase tracking-[0.12em] transition-colors font-mono-data flex items-center gap-1.5 ${
              location.pathname.startsWith('/console')
                ? 'text-white'
                : 'text-[#A8A8A8] hover:text-white'
            }`}
          >
            <Settings size={12} />
            控制台
          </Link>
        ) : (
          <button
            onClick={onLogin}
            className="text-[11px] uppercase tracking-[0.12em] transition-colors font-mono-data flex items-center gap-1.5 text-[#A8A8A8] hover:text-white"
          >
            <Settings size={12} />
            控制台
          </button>
        )}

        <div className="w-px h-4 bg-[#262626]" />

        {isLoggedIn ? (
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-[#A8A8A8] font-mono-data flex items-center gap-1.5">
              <User size={12} />
              {username || 'User'}
            </span>
            <button
              onClick={onLogout}
              className="text-[#A8A8A8] hover:text-white transition-colors"
              title="退出"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={onLogin}
              className="text-[11px] text-[#A8A8A8] hover:text-white uppercase tracking-[0.12em] transition-colors font-mono-data"
            >
              登录
            </button>
            <button
              onClick={onRegister}
              className="text-[11px] text-black bg-white px-4 py-1.5 uppercase tracking-[0.12em] hover:bg-[#E0E0E0] transition-colors font-mono-data"
            >
              注册
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
