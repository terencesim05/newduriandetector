import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

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
    <header className="h-16 border-b border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-md flex items-center px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">DurianDetector</span>
          <span className="text-slate-600">/</span>
          <span className="text-white font-medium">{title}</span>
        </div>
      </div>
    </header>
  );
}
