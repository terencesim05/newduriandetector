import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { FileText, RefreshCw } from 'lucide-react';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'admin_login', label: 'Admin Login' },
  { value: 'user_login', label: 'User Login' },
  { value: 'user_registered', label: 'User Registered' },
  { value: 'user_suspended', label: 'User Suspended' },
  { value: 'user_unsuspended', label: 'User Unsuspended' },
  { value: 'tier_changed', label: 'Tier Changed' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'team_deleted', label: 'Team Deleted' },
  { value: 'member_removed', label: 'Member Removed' },
];

export default function AuditLogs() {
  const { user } = useAuth();
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [myActionsOnly, setMyActionsOnly] = useState(false);

  const load = async () => {
    try {
      const data = await adminService.getAuditLog(200);
      setAllLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filteredLogs = allLogs.filter((entry) => {
    if (actionFilter && entry.action !== actionFilter) return false;
    if (myActionsOnly && entry.user_email !== user?.email) return false;
    return true;
  });

  const actionBadge = (action) => {
    const map = {
      admin_login: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      user_login: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      user_registered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      user_suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
      user_unsuspended: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      tier_changed: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      password_reset: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      team_deleted: 'bg-red-500/10 text-red-400 border-red-500/20',
      member_removed: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };
    return map[action] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-slate-400 mt-1">{filteredLogs.length} entries{myActionsOnly ? ' (my actions)' : ''}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-slate-300 hover:bg-white/[0.07] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none cursor-pointer"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <button
          onClick={() => setMyActionsOnly(!myActionsOnly)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
            myActionsOnly
              ? 'bg-red-500/15 border-red-500/20 text-red-400'
              : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.07]'
          }`}
        >
          {myActionsOnly ? 'My Actions Only' : 'All Users'}
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#0d1221]">
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Timestamp</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Action</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">User</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Details</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No audit log entries found.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${actionBadge(entry.action)}`}>
                        {entry.action?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-white">{entry.user_email || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-400">{entry.details || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{entry.ip_address || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
