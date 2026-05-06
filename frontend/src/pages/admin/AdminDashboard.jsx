import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import {
  Search,
  FileText,
  TrendingUp,
  UsersRound,
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.allSettled([
          adminService.getStats(),
          adminService.getAuditLog(10),
          adminService.getUsers({ per_page: 5 }),
        ]);

        if (results[0].status === 'fulfilled') setStats(results[0].value);
        if (results[1].status === 'fulfilled') setAuditLog(results[1].value);
        if (results[2].status === 'fulfilled') setRecentUsers(results[2].value.users || []);
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
