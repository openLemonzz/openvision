import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Image,
  Gift,
  UserCircle,
  Menu,
  X,
  Settings,
  ArrowLeft,
  Clock,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/console', label: '影像档案', icon: Image },
  { path: '/console/generations', label: '生成记录', icon: Clock },
  { path: '/console/invite', label: '邀请计划', icon: Gift },
  { path: '/console/account', label: '账户设置', icon: UserCircle },
];

export default function ConsoleLayout() {
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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[220px] bg-[#111] border-r border-[#222] flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-[#222]">
          <Settings size={15} className="text-white mr-2.5" />
          <span className="text-[13px] font-medium tracking-[0.12em] uppercase">
            控制台
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
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-[#222]">
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-[12px] text-[#888] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            <span>返回工坊</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center px-5 border-b border-[#222] bg-[#0a0a0a]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[#888] hover:text-white mr-4"
          >
            <Menu size={18} />
          </button>
          <span className="text-[11px] text-[#666] uppercase tracking-[0.15em] font-mono-data">
            {NAV_ITEMS.find(n => n.path === location.pathname)?.label || '影像档案'}
          </span>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
