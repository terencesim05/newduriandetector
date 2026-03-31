import { useLocation } from 'react-router-dom';
import { Menu, Search, Bell } from 'lucide-react';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/alerts': 'Alerts',
  '/incidents': 'Incidents',
  '/teams': 'Teams',
  '/settings': 'Settings',
};

export default function Navbar({ onMenuClick }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <header className="h-16 border-b border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">IDS Monitor</span>
          <span className="text-slate-600">/</span>
          <span className="text-white font-medium">{title}</span>
        </div>
      </div>

      {/* Right: search + notifications */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 w-56">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-full"
          />
        </div>

        {/* Notification bell */}
        <button className="relative text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.05] cursor-pointer">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
