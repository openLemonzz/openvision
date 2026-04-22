import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Cpu,
  Image,
  ArrowLeft,
  Menu,
  X,
  Shield,
  LogOut,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', label: '用户管理', icon: Users },
  { path: '/models', label: '模型配置', icon: Cpu },
  { path: '/generations', label: '生成记录', icon: Image },
];

interface AdminLayoutProps {
  onLogout: () => void;
}

export default function AdminLayout({ onLogout }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[240px] bg-[#111] border-r border-[#222] flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-[#222]">
          <Shield size={16} className="text-white mr-2.5" />
          <span className="text-[13px] font-medium tracking-[0.12em] uppercase">
            VISION Admin
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-[#666] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-[12px] tracking-wide transition-colors rounded-sm ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-[#888] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
                {isActive && <ChevronRight size={12} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-[#222] space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 text-[12px] text-[#888] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            <span>返回前台</span>
          </Link>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] text-[#888] hover:text-red-400 transition-colors"
          >
            <LogOut size={14} />
            <span>退出管理</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center px-5 border-b border-[#222] bg-[#0a0a0a]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[#888] hover:text-white mr-4"
          >
            <Menu size={18} />
          </button>
          <span className="text-[11px] text-[#666] uppercase tracking-[0.15em] font-mono-data">
            {NAV_ITEMS.find(n => n.path === location.pathname)?.label || 'Dashboard'}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] text-[#555] font-mono-data px-2 py-1 border border-[#333]">
              ADMIN
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
