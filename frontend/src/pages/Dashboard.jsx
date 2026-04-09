import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { alertService } from '../services/alertService';
import { useSSE } from '../context/SSEContext';
import { useAlertNotifications } from '../hooks/useAlertNotifications.jsx';
import LiveAlertFeed from '../components/LiveAlertFeed';
import ConnectionStatus from '../components/ConnectionStatus';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Activity,
  ArrowRight,
  UserCheck,
  Bot,
  Radio,
  X,
} from 'lucide-react';

const severityColors = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const colorMap = {
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', bar: 'bg-red-500' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const isExclusive = user?.tier?.toUpperCase() === 'EXCLUSIVE';
  const isExclusiveMember = isExclusive && !user?.is_team_leader;
  const [myAlerts, setMyAlerts] = useState([]);
  const [watcherDismissed, setWatcherDismissed] = useState(() => localStorage.getItem('watcher_nudge_dismissed') === 'true');
  const [hasApiKeys, setHasApiKeys] = useState(null);
  const { alerts: liveAlerts, stats: liveStats, connected, error, reconnect, dismissAlert, dismissAllAlerts } = useSSE();

  // Notifications for new alerts
  useAlertNotifications(liveAlerts);

  // Check if user has any active API keys (watcher connected indicator)
  useEffect(() => {
    if (isExclusiveMember || watcherDismissed) return;
    const logApi = axios.create({ baseURL: API_CONFIG.LOG_BASE_URL });
    const token = localStorage.getItem('accessToken');
    if (token) logApi.defaults.headers.Authorization = `Bearer ${token}`;
    logApi.get('/api/api-keys').then((res) => {
      const active = (res.data || []).filter((k) => k.is_active);
      setHasApiKeys(active.length > 0);
    }).catch(() => setHasApiKeys(false));
  }, [isExclusiveMember, watcherDismissed]);

  const showWatcherNudge = !isExclusiveMember && !watcherDismissed && hasApiKeys === false;

  const dismissWatcherNudge = () => {
    setWatcherDismissed(true);
    localStorage.setItem('watcher_nudge_dismissed', 'true');
  };

  useEffect(() => {
    if (isExclusive) {
      alertService.getAlerts({ assignment: 'mine', pageSize: 5 }).then((data) => {
        setMyAlerts(data.alerts || []);
      }).catch(() => {});
    }
  }, [isExclusive]);

  const statCards = [
    { label: 'Total Alerts', value: liveStats?.total ?? '—', icon: Bell, color: 'blue' },
    { label: 'Critical Alerts', value: liveStats?.critical ?? '—', icon: ShieldAlert, color: 'red' },
    { label: 'Alerts Today', value: liveStats?.today ?? '—', icon: AlertTriangle, color: 'orange' },
    { label: 'Blocked', value: liveStats?.blocked ?? '—', icon: Activity, color: 'emerald' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome + Connection Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.first_name || 'User'}!
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Here's what's happening with your network security today.
          </p>
        </div>
        <ConnectionStatus connected={connected} error={error} onReconnect={reconnect} />
      </div>

      {/* IDS Watcher nudge */}
      {showWatcherNudge && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Radio className="w-[18px] h-[18px] text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-amber-300">No IDS watcher connected</h3>
            <p className="text-xs text-amber-200/60 mt-0.5">
              Set up a watcher to start receiving real-time alerts from your IDS engines (Suricata, Snort, Zeek, Kismet).
            </p>
            <Link
              to="/settings"
              state={{ tab: 'ids-setup' }}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 mt-2 transition-colors"
            >
              Set up IDS Watcher <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <button
            onClick={dismissWatcherNudge}
            className="text-amber-500/40 hover:text-amber-400 transition-colors cursor-pointer shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => {
          const c = colorMap[color];
          return (
            <div
              key={label}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">{label}</span>
                <div className={`w-9 h-9 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center`}>
                  <Icon className={`w-[18px] h-[18px] ${c.text}`} />
                </div>
              </div>
              <span className={`text-2xl font-bold text-white transition-all`}>{value}</span>
            </div>
          );
        })}
      </div>

      {/* Live Alert Feed */}
      <LiveAlertFeed alerts={liveAlerts} connected={connected} onDismiss={dismissAlert} onDismissAll={dismissAllAlerts} />

      {/* DurianBot widget */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-blue-500/20 transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              DurianBot
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">AI</span>
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">Ask about your alerts, block IPs, create incidents, or get a threat summary.</p>
          </div>
          <Link to="/chatbot" className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 flex items-center gap-1.5">
            Open Chat <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* My Assignments — EXCLUSIVE only */}
      {isExclusive && myAlerts.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-semibold text-white">My Assignments</h2>
            </div>
            <a href="/alerts?assignment=mine" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Severity</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Category</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Source IP</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Score</th>
                </tr>
              </thead>
              <tbody>
                {myAlerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${severityColors[alert.severity]}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-300 font-mono">{alert.category}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.source_ip}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.threat_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
