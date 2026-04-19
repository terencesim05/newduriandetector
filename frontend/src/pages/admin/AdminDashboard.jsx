import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import {
  Users,
  CreditCard,
  DollarSign,
  Bell,
  Search,
  FileText,
  TrendingUp,
  UserPlus,
  UsersRound,
  ShieldAlert,
  Database,
  Server,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [alertStats, setAlertStats] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [teamData, setTeamData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.allSettled([
          adminService.getStats(),
          adminService.getAlertStats(),
          adminService.getAuditLog(10),
          adminService.getUsers({ per_page: 5 }),
          adminService.getTeams(),
          adminService.getSystemHealth(),
        ]);

        if (results[0].status === 'fulfilled') setStats(results[0].value);
        if (results[1].status === 'fulfilled') setAlertStats(results[1].value);
        if (results[2].status === 'fulfilled') setAuditLog(results[2].value);
        if (results[3].status === 'fulfilled') setRecentUsers(results[3].value.users || []);
        if (results[4].status === 'fulfilled') setTeamData(results[4].value);
        if (results[5].status === 'fulfilled') setHealth(results[5].value);
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.total_users || 0,
      icon: Users,
      color: 'blue',
      sub: `${stats?.new_users_today || 0} new today`,
    },
    {
      label: 'Active Subscriptions',
      value: stats?.active_subscriptions || 0,
      icon: CreditCard,
      color: 'green',
      sub: `${stats?.suspended_users || 0} suspended`,
    },
    {
      label: 'Revenue This Month',
      value: `$${(stats?.revenue_this_month || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'purple',
      sub: `${stats?.new_users_month || 0} new users this month`,
    },
    {
      label: 'Alerts Processed Today',
      value: alertStats?.alerts_today || 0,
      icon: Bell,
      color: 'red',
      sub: `${alertStats?.total_alerts || 0} total all-time`,
    },
  ];

  const colorMap = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: 'text-blue-400' },
    green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', icon: 'text-purple-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: 'text-red-400' },
  };

  const tierColors = {
    FREE: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    PREMIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    EXCLUSIVE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Platform overview and quick actions</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const c = colorMap[card.color];
          return (
            <div key={card.label} className={`${c.bg} border ${c.border} rounded-xl p-5`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-400">{card.label}</span>
                <card.icon className={`w-5 h-5 ${c.icon}`} />
              </div>
              <p className={`text-2xl font-bold mt-2 ${c.text}`}>{card.value}</p>
              <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* System Health + Alert Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Health */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">System Health</h2>
          <div className="space-y-3">
            <div className={`flex items-center justify-between p-3 rounded-lg border ${health?.database?.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-center gap-2">
                <Database className={`w-4 h-4 ${health?.database?.ok ? 'text-emerald-400' : 'text-red-400'}`} />
                <span className="text-sm text-white">Database</span>
              </div>
              {health?.database?.ok ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> Connected</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" /> Disconnected</span>
              )}
            </div>
            <div className={`flex items-center justify-between p-3 rounded-lg border ${health?.fastapi?.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-center gap-2">
                <Server className={`w-4 h-4 ${health?.fastapi?.ok ? 'text-emerald-400' : 'text-red-400'}`} />
                <span className="text-sm text-white">FastAPI</span>
              </div>
              {health?.fastapi?.ok ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> Running</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" /> Down</span>
              )}
            </div>
          </div>
        </div>

        {/* Alert Overview */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Alert Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'This Week', value: alertStats?.alerts_this_week || 0, color: 'text-blue-400' },
              { label: 'Flagged', value: alertStats?.blocked_alerts || 0, color: 'text-red-400' },
              { label: 'Quarantined', value: alertStats?.quarantined_alerts || 0, color: 'text-yellow-400' },
              { label: 'Teams', value: teamData?.total || 0, color: 'text-purple-400' },
            ].map((item) => (
              <div key={item.label} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tier Breakdown + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">User Tier Breakdown</h2>
          <div className="space-y-3">
            {[
              { tier: 'FREE', count: stats?.tier_breakdown?.FREE || 0, color: 'bg-gray-400' },
              { tier: 'PREMIUM', count: stats?.tier_breakdown?.PREMIUM || 0, color: 'bg-blue-500' },
              { tier: 'EXCLUSIVE', count: stats?.tier_breakdown?.EXCLUSIVE || 0, color: 'bg-purple-500' },
            ].map(({ tier, count, color }) => {
              const total = stats?.total_users || 1;
              const pct = ((count / total) * 100).toFixed(1);
              return (
                <div key={tier}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{tier}</span>
                    <span className="text-slate-400">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/admin/users')} className="flex items-center gap-3 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.07] transition-all text-left cursor-pointer">
              <Search className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-slate-300">Search Users</span>
            </button>
            <button onClick={() => navigate('/admin/audit')} className="flex items-center gap-3 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.07] transition-all text-left cursor-pointer">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-slate-300">View Audit Logs</span>
            </button>
            <button onClick={() => navigate('/admin/subscriptions')} className="flex items-center gap-3 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.07] transition-all text-left cursor-pointer">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-300">Revenue Stats</span>
            </button>
            <button onClick={() => navigate('/admin/teams')} className="flex items-center gap-3 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.07] transition-all text-left cursor-pointer">
              <UsersRound className="w-4 h-4 text-red-400" />
              <span className="text-sm text-slate-300">Manage Teams</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Users + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent Users</h2>
            <button onClick={() => navigate('/admin/users')} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">View all</button>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-slate-500">No users yet.</p>
          ) : (
            <div className="space-y-2">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {(u.first_name?.[0] || u.email?.[0] || 'U').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-white">{u.email}</p>
                      <p className="text-xs text-slate-500">{new Date(u.date_joined || u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium uppercase px-2 py-0.5 rounded-full border ${tierColors[u.tier] || tierColors.FREE}`}>
                    {u.tier}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            <button onClick={() => navigate('/admin/audit')} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">View all</button>
          </div>
          {auditLog.length === 0 ? (
            <p className="text-sm text-slate-500">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {auditLog.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    entry.action === 'user_suspended' ? 'bg-red-400'
                      : entry.action === 'tier_changed' ? 'bg-purple-400'
                      : entry.action === 'password_reset' ? 'bg-yellow-400'
                      : entry.action === 'admin_login' ? 'bg-blue-400'
                      : entry.action === 'user_login' ? 'bg-blue-400'
                      : entry.action === 'user_registered' ? 'bg-emerald-400'
                      : 'bg-slate-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-300">
                      <span className="text-white font-medium">{entry.user_email}</span>
                      {' '}{entry.details}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/[0.06] text-slate-400 shrink-0">
                    {entry.action?.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
