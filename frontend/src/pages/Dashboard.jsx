import { useAuth } from '../context/AuthContext';
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Activity,
  ArrowRight,
  ScanLine,
  FileText,
  Plus,
} from 'lucide-react';

const mockAlerts = [
  { time: '2 min ago', severity: 'CRITICAL', category: 'SQL_INJECTION', sourceIp: '192.168.1.105' },
  { time: '8 min ago', severity: 'HIGH', category: 'BRUTE_FORCE', sourceIp: '10.0.2.34' },
  { time: '15 min ago', severity: 'MEDIUM', category: 'XSS', sourceIp: '192.168.3.88' },
  { time: '32 min ago', severity: 'HIGH', category: 'MALWARE', sourceIp: '10.0.1.12' },
  { time: '1 hr ago', severity: 'LOW', category: 'DDOS', sourceIp: '192.168.2.200' },
];

const severityColors = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const stats = [
  { label: 'Total Alerts', value: '127', icon: Bell, color: 'blue' },
  { label: 'Critical Alerts', value: '8', icon: ShieldAlert, color: 'red' },
  { label: 'Open Incidents', value: '3', icon: AlertTriangle, color: 'orange' },
  { label: 'Threat Score', value: '72', icon: Activity, color: 'emerald', isProgress: true },
];

const colorMap = {
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', bar: 'bg-red-500' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
};

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.first_name || 'User'}!
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Here's what's happening with your network security today.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, isProgress }) => {
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
              {isProgress ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">{value}</span>
                    <span className="text-sm text-slate-500">/100</span>
                  </div>
                  <div className="mt-3 w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${c.bar} rounded-full transition-all`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </>
              ) : (
                <span className="text-2xl font-bold text-white">{value}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Alerts */}
        <div className="xl:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-base font-semibold text-white">Recent Alerts</h2>
            <a
              href="/alerts"
              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Time</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Severity</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Category</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Source IP</th>
                </tr>
              </thead>
              <tbody>
                {mockAlerts.map((alert, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 text-sm text-slate-400">{alert.time}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${severityColors[alert.severity]}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-300 font-mono">{alert.category}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.sourceIp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 transition-all cursor-pointer text-sm font-medium">
              <Plus className="w-4 h-4" />
              Create Incident
            </button>
            <button className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 transition-all cursor-pointer text-sm font-medium">
              <ScanLine className="w-4 h-4" />
              Run Scan
            </button>
            <button className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/15 transition-all cursor-pointer text-sm font-medium">
              <FileText className="w-4 h-4" />
              View Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
