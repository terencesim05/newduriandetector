import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Bell,
  AlertTriangle,
  Users,
  Settings,
  LogOut,
  Shield,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ShieldQuestion,
  Workflow,
  BrainCircuit,
  BarChart3,
  Globe,
  FileUp,
  ChevronDown,
  X,
} from 'lucide-react';

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Detection',
    items: [
      { to: '/alerts', label: 'Alerts', icon: Bell },
      { to: '/ingestion-logs', label: 'Ingestion Logs', icon: FileUp },
      { to: '/quarantine', label: 'Quarantine', icon: ShieldQuestion },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/threat-intel', label: 'Threat Intel', icon: ShieldAlert },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/attack-globe', label: 'GeoIP Map', icon: Globe },
    ],
  },
  {
    label: 'Policies',
    items: [
      { to: '/rules', label: 'Rules', icon: Workflow },
      { to: '/blacklist', label: 'Blacklist', icon: ShieldBan },
      { to: '/whitelist', label: 'Whitelist', icon: ShieldCheck },
      { to: '/ml-config', label: 'ML Config', icon: BrainCircuit, premiumOnly: true },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
      { to: '/teams', label: 'Teams', icon: Users, exclusiveOnly: true },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function SectionGroup({ label, items, tier, onClose }) {
  const location = useLocation();
  const hasActiveChild = items.some((item) => location.pathname === item.to);
  const [open, setOpen] = useState(hasActiveChild);

  // Filter by tier
  const visibleItems = items
    .filter(({ premiumOnly }) => !premiumOnly || ['PREMIUM', 'EXCLUSIVE'].includes(tier.toUpperCase()))
    .filter(({ exclusiveOnly }) => !exclusiveOnly || tier.toUpperCase() === 'EXCLUSIVE');

  if (visibleItems.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
      >
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {visibleItems.map(({ to, label: itemLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {itemLabel}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const tier = user?.tier || 'free';

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#0d1221] border-r border-white/[0.06] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06] shrink-0">
          <NavLink to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              DurianDetector
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
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navSections.map((section) => (
            <SectionGroup
              key={section.label}
              label={section.label}
              items={section.items}
              tier={tier}
              onClose={onClose}
            />
          ))}
        </nav>

        {/* User profile */}
        <div className="px-3 pb-4 mt-auto shrink-0">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user?.first_name
                    ? `${user.first_name} ${user.last_name || ''}`.trim()
                    : user?.email || 'User'}
                </p>
                <span
                  className="inline-block mt-0.5 text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border-2"
                  style={{
                    borderColor: tier === 'free' ? '#9CA3AF' : tier === 'premium' ? '#3B82F6' : '#A855F7',
                    color: tier === 'free' ? '#9CA3AF' : tier === 'premium' ? '#3B82F6' : '#A855F7',
                    backgroundColor: tier === 'free' ? 'rgba(156,163,175,0.1)' : tier === 'premium' ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)',
                  }}
                >
                  {tier}
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
