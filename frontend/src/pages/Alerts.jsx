import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const severityColors = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const mockAlerts = [
  { time: '14:32:05', severity: 'CRITICAL', category: 'SQL_INJECTION', srcIp: '192.168.1.105', dstIp: '10.0.0.5' },
  { time: '14:28:17', severity: 'HIGH', category: 'BRUTE_FORCE', srcIp: '10.0.2.34', dstIp: '192.168.1.1' },
  { time: '14:15:42', severity: 'CRITICAL', category: 'MALWARE', srcIp: '192.168.3.88', dstIp: '10.0.0.12' },
  { time: '14:02:30', severity: 'MEDIUM', category: 'XSS', srcIp: '10.0.1.56', dstIp: '192.168.2.100' },
  { time: '13:55:11', severity: 'HIGH', category: 'DDOS', srcIp: '192.168.2.200', dstIp: '10.0.0.1' },
  { time: '13:41:58', severity: 'LOW', category: 'BRUTE_FORCE', srcIp: '10.0.3.15', dstIp: '192.168.1.50' },
  { time: '13:30:22', severity: 'MEDIUM', category: 'SQL_INJECTION', srcIp: '192.168.4.77', dstIp: '10.0.0.8' },
  { time: '13:18:45', severity: 'HIGH', category: 'MALWARE', srcIp: '10.0.1.12', dstIp: '192.168.3.200' },
  { time: '13:05:33', severity: 'LOW', category: 'XSS', srcIp: '192.168.1.230', dstIp: '10.0.2.50' },
  { time: '12:52:10', severity: 'CRITICAL', category: 'DDOS', srcIp: '10.0.4.100', dstIp: '192.168.1.1' },
];

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');

  const selectClass =
    'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Security Alerts</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className={selectClass}
        >
          <option value="All">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={selectClass}
        >
          <option value="All">All Categories</option>
          <option value="SQL_INJECTION">SQL Injection</option>
          <option value="DDOS">DDoS</option>
          <option value="MALWARE">Malware</option>
          <option value="BRUTE_FORCE">Brute Force</option>
          <option value="XSS">XSS</option>
        </select>

        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Time', 'Severity', 'Category', 'Source IP', 'Destination IP', 'Actions'].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {mockAlerts.map((alert, i) => (
                <tr
                  key={i}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.time}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${severityColors[alert.severity]}`}
                    >
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-300 font-mono">{alert.category}</td>
                  <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.srcIp}</td>
                  <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.dstIp}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                        View Details
                      </button>
                      <span className="text-slate-700">|</span>
                      <button className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer">
                        Create Incident
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
          <span className="text-sm text-slate-500">Showing 1-10 of 127 alerts</span>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  p === 1
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {p}
              </button>
            ))}
            <span className="text-slate-600 px-1">...</span>
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer">
              13
            </button>
            <button className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
