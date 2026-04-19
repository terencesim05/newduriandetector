import { useState, useEffect } from 'react';
import { ShieldQuestion, Loader2, ShieldCheck, ShieldBan, Trash2 } from 'lucide-react';
import { alertService } from '../services/alertService';

const severityColors = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const statusColors = {
  QUARANTINED: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  RELEASED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  BLOCKED: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export default function Quarantine() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ pending: 0, released: 0, blocked: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('QUARANTINED');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertData, statsData] = await Promise.all([
        alertService.getQuarantined(filter === 'All' ? undefined : filter),
        alertService.getQuarantineStats(),
      ]);
      setAlerts(alertData);
      setStats(statsData);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch quarantine data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleRelease = async (id) => {
    setActionLoading(id);
    try {
      await alertService.releaseFromQuarantine(id, 'Reviewed and released');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to release alert');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (id) => {
    setActionLoading(id);
    try {
      await alertService.blockFromQuarantine(id, 'Confirmed threat — blocked and blacklisted');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to block alert');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (id) => {
    setActionLoading(id);
    try {
      await alertService.removeFromQuarantine(id);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove from quarantine');
    } finally {
      setActionLoading(null);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const selectClass =
    'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldQuestion className="w-6 h-6 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Quarantine</h1>
        </div>
        {stats.pending > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-sm text-yellow-400 font-medium">
            {stats.pending} alert{stats.pending !== 1 ? 's' : ''} pending review
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Released</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.released}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Flagged</p>
          <p className="text-2xl font-bold text-red-400">{stats.blocked}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Reviewed</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
      </div>

      {/* Filter */}
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className={selectClass}>
        <option value="All">All Statuses</option>
        <option value="QUARANTINED">Pending Review</option>
        <option value="RELEASED">Released</option>
        <option value="BLOCKED">Flagged</option>
      </select>

      {/* Info */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-400/80">
        Alerts with threat score between 0.7 and 0.9 are held here for review. Score 0.9+ is auto-flagged as a threat. Score below 0.7 passes through normally.
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Time', 'Severity', 'Category', 'Source IP', 'Score', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                    <span className="text-sm text-slate-500">Loading...</span>
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                    {filter === 'QUARANTINED' ? 'No alerts pending review' : 'No quarantine entries found'}
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{formatTime(alert.quarantined_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${severityColors[alert.severity]}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-300 font-mono">{alert.category}</td>
                    <td className="px-5 py-3 text-sm text-white font-mono">{alert.source_ip}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.threat_score}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${statusColors[alert.quarantine_status]}`}>
                        {alert.quarantine_status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {alert.quarantine_status === 'QUARANTINED' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRelease(alert.id)}
                            disabled={actionLoading === alert.id}
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            Release
                          </button>
                          <span className="text-slate-700">|</span>
                          <button
                            onClick={() => handleBlock(alert.id)}
                            disabled={actionLoading === alert.id}
                            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <ShieldBan className="w-3 h-3" />
                            Flag as Threat
                          </button>
                          <span className="text-slate-700">|</span>
                          <button
                            onClick={() => handleRemove(alert.id)}
                            disabled={actionLoading === alert.id}
                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {alert.review_notes || 'Reviewed'}
                        </span>
                      )}
                    </td>
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
