import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  CreditCard,
  Activity,
  FileText,
  LogOut,
  ShieldAlert,
  X,
} from 'lucide-react';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'User Management', icon: Users },
  { to: '/admin/teams', label: 'Team Management', icon: UsersRound },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/admin/system', label: 'System Monitoring', icon: Activity },
  { to: '/admin/audit', label: 'Audit Logs', icon: FileText },
];

export default function AdminSidebar({ open, onClose }) {
  const { user, logout } = useAuth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#0d1117] border-r border-red-500/10 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-red-500/10 shrink-0">
          <NavLink to="/admin/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              Admin Panel
            </span>
          </NavLink>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {label}
            </NavLink>
          ))}

        </nav>

        {/* Admin profile */}
        <div className="px-3 pb-4 mt-auto shrink-0">
          <div className="bg-white/[0.03] border border-red-500/10 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {(user?.first_name?.[0] || user?.email?.[0] || 'A').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user?.first_name
                    ? `${user.first_name} ${user.last_name || ''}`.trim()
                    : user?.email || 'Admin'}
                </p>
                <span className="inline-block mt-0.5 text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border-2 border-red-500 text-red-500 bg-red-500/10">
                  ADMIN
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full mt-3 px-3 py-2 text-sm text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
