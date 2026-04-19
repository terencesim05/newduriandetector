import { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import {
  Database,
  Server,
  Bell,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export default function SystemMonitoring() {
  const [health, setHealth] = useState(null);
  const [alertStats, setAlertStats] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [h, a, log] = await Promise.all([
        adminService.getSystemHealth(),
        adminService.getAlertStats(),
        adminService.getActivityLog(100),
      ]);
      setHealth(h);
      setAlertStats(a);
      setActivityLog(log);
    } catch (err) {
      console.error('Failed to load system health:', err);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const healthChecks = [
    { label: 'Database', status: health?.database?.ok ? 'connected' : 'disconnected', ok: health?.database?.ok, icon: Database },
    { label: 'FastAPI Log Service', status: health?.fastapi?.ok ? 'running' : 'down', ok: health?.fastapi?.ok, icon: Server },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Monitoring</h1>
          <p className="text-sm text-slate-400 mt-1">System health and activity logs</p>
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

      {/* Health Checks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {healthChecks.map((check) => (
          <div key={check.label} className={`border rounded-xl p-5 ${check.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <check.icon className={`w-5 h-5 ${check.ok ? 'text-emerald-400' : 'text-red-400'}`} />
                <span className="text-sm font-medium text-white">{check.label}</span>
              </div>
              {check.ok ? (
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-medium capitalize">{check.status}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-red-400">
                  <XCircle className="w-4 h-4" />
                  <span className="text-xs font-medium capitalize">{check.status}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Alert Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Alerts', value: alertStats?.total_alerts || 0, icon: Bell, color: 'text-blue-400' },
          { label: 'Today', value: alertStats?.alerts_today || 0, icon: Activity, color: 'text-emerald-400' },
          { label: 'This Week', value: alertStats?.alerts_this_week || 0, icon: Activity, color: 'text-purple-400' },
          { label: 'Flagged', value: alertStats?.blocked_alerts || 0, icon: XCircle, color: 'text-red-400' },
          { label: 'Quarantined', value: alertStats?.quarantined_alerts || 0, icon: AlertTriangle, color: 'text-yellow-400' },
        ].map((m) => (
          <div key={m.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <m.icon className={`w-5 h-5 ${m.color} mx-auto mb-2`} />
            <p className="text-xl font-bold text-white">{m.value.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Activity Log */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Audit Log (Recent 100 Actions)</h2>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#0d1221]">
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Time</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">User</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Action</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {activityLog.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">No activity logs found.</td>
                </tr>
              ) : (
                activityLog.map((a) => (
                  <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{a.timestamp ? new Date(a.timestamp).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-white">{a.user_name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-300">{a.action?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-400 max-w-xs truncate">{a.details || '—'}</td>
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
