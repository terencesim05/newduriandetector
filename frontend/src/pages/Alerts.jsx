import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2, ShieldAlert, ShieldBan, ShieldCheck, ShieldQuestion, UserCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { alertService } from '../services/alertService';

const severityColors = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

function ThreatDetailModal({ alert, onClose }) {
  const intel = alert.threat_intel;
  if (!intel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0f1320] border border-white/[0.08] rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-semibold text-white">ThreatFox Intel</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold px-2 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/30">
              KNOWN THREAT
            </span>
            <span className="text-xs text-slate-400 font-mono">{alert.source_ip}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Malware Family</p>
              <p className="text-sm text-white font-medium">{intel.malware || 'Unknown'}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Threat Type</p>
              <p className="text-sm text-white font-medium">{intel.threat_type || 'Unknown'}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Confidence</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${intel.confidence_level || 0}%` }}
                  />
                </div>
                <span className="text-sm text-white font-medium">{intel.confidence_level || 0}%</span>
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {(intel.tags || []).length > 0 ? (
                  intel.tags.map((tag) => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">None</span>
                )}
              </div>
            </div>
          </div>

          {(intel.first_seen || intel.last_seen) && (
            <div className="bg-white/[0.03] rounded-lg p-3">
              <div className="flex justify-between text-sm">
                {intel.first_seen && (
                  <div>
                    <span className="text-slate-500">First seen: </span>
                    <span className="text-slate-300">{intel.first_seen}</span>
                  </div>
                )}
                {intel.last_seen && (
                  <div>
                    <span className="text-slate-500">Last seen: </span>
                    <span className="text-slate-300">{intel.last_seen}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {intel.reference && (
            <a
              href={intel.reference}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-400 hover:text-blue-300 transition-colors truncate"
            >
              {intel.reference}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Alerts() {
  const { user } = useAuth();
  const isExclusive = user?.tier?.toUpperCase() === 'EXCLUSIVE';
  const [severityFilter, setSeverityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [assignmentFilter, setAssignmentFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [mlFlagged, setMlFlagged] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (isExclusive) {
      import('../services/authService').then(({ authService }) => {
        authService.getMyTeam().then((team) => {
          if (team?.members) setTeamMembers(team.members);
        }).catch(() => {});
      });
    }
  }, [isExclusive]);

  useEffect(() => {
    setPage(1);
  }, [severityFilter, categoryFilter, assignmentFilter, mlFlagged]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAlerts() {
      setLoading(true);
      setError(null);
      try {
        const data = await alertService.getAlerts({
          severity: severityFilter,
          category: categoryFilter,
          assignment: assignmentFilter,
          mlFlagged,
          page,
          pageSize,
        });
        if (!cancelled) {
          setAlerts(data.alerts);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || 'Failed to fetch alerts');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAlerts();
    return () => { cancelled = true; };
  }, [severityFilter, categoryFilter, assignmentFilter, mlFlagged, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filteredAlerts = search
    ? alerts.filter(
        (a) =>
          a.source_ip.includes(search) ||
          a.destination_ip.includes(search) ||
          a.category.toLowerCase().includes(search.toLowerCase())
      )
    : alerts;

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const selectClass =
    'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

  const pageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    if (start > 1) pages.push(1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    if (end < totalPages) pages.push(totalPages);
    return pages;
  };

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
          <option value="PORT_SCAN">Port Scan</option>
          <option value="COMMAND_INJECTION">Command Injection</option>
          <option value="PRIVILEGE_ESCALATION">Privilege Escalation</option>
          <option value="DATA_EXFILTRATION">Data Exfiltration</option>
          <option value="ANOMALY">Anomaly</option>
        </select>

        {isExclusive && (
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            className={selectClass}
          >
            <option value="All">All Assignments</option>
            <option value="mine">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        )}

        <label className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mlFlagged}
            onChange={(e) => setMlFlagged(e.target.checked)}
            className="accent-purple-500"
          />
          <span className="text-sm text-slate-300 whitespace-nowrap">ML-flagged only</span>
        </label>

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

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {[...['Time', 'Severity', 'Category', 'Source IP', 'Destination IP', 'Score', 'ML', 'Intel'], ...(isExclusive ? ['Assigned'] : []), 'Actions'].map(
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
              {loading ? (
                <tr>
                  <td colSpan={isExclusive ? 10 : 9} className="px-5 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                    <span className="text-sm text-slate-500">Loading alerts...</span>
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={isExclusive ? 10 : 9} className="px-5 py-12 text-center text-sm text-slate-500">
                    No alerts found
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">
                      {formatTime(alert.detected_at)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${severityColors[alert.severity]}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-300 font-mono">{alert.category}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.source_ip}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.destination_ip}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{alert.threat_score}</td>
                    <td className="px-5 py-3">
                      {alert.ml_confidence != null ? (
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${
                            alert.ml_confidence > 0.7
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : alert.ml_confidence >= 0.3
                              ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          ML: {Math.round(alert.ml_confidence * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">N/A</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {alert.is_whitelisted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3" />
                          TRUSTED
                        </span>
                      ) : alert.is_blocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-red-500/15 text-red-400 border-red-500/30">
                          <ShieldBan className="w-3 h-3" />
                          BLOCKED
                        </span>
                      ) : alert.quarantine_status === 'QUARANTINED' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                          <ShieldQuestion className="w-3 h-3" />
                          QUARANTINED
                        </span>
                      ) : alert.flagged_by_threatfox === 'true' ? (
                        <button
                          onClick={() => setSelectedAlert(alert)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25 transition-colors cursor-pointer"
                          title="Click to view ThreatFox intel"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          FLAGGED
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">Clean</span>
                      )}
                    </td>
                    {isExclusive && (
                      <td className="px-5 py-3">
                        {alert.assigned_name ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                            <UserCheck className="w-3 h-3" />
                            {alert.assigned_name}
                          </span>
                        ) : user?.is_team_leader ? (
                          <select
                            value=""
                            onChange={async (e) => {
                              const memberId = parseInt(e.target.value);
                              const member = teamMembers.find((m) => m.id === memberId);
                              if (member) {
                                try {
                                  await alertService.assignAlert(alert.id, memberId, `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email);
                                  setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, assigned_to: memberId, assigned_name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email } : a));
                                } catch {}
                              }
                            }}
                            className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-slate-400 outline-none cursor-pointer appearance-none"
                          >
                            <option value="">Assign...</option>
                            {teamMembers.map((m) => (
                              <option key={m.id} value={m.id}>{m.first_name || m.email}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-600">Unassigned</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedAlert(alert)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        {!alert.is_blocked && !alert.is_whitelisted && (
                          <>
                            <span className="text-slate-700">|</span>
                            <button
                              onClick={async () => {
                                try {
                                  await alertService.addToBlacklist({ entry_type: 'IP', value: alert.source_ip, reason: `Blocked from alert ${alert.category}` });
                                } catch {}
                              }}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            >
                              Block IP
                            </button>
                            <span className="text-slate-700">|</span>
                            <button
                              onClick={async () => {
                                try {
                                  await alertService.addToWhitelist({ entry_type: 'IP', value: alert.source_ip, reason: `Trusted from alerts page` });
                                } catch {}
                              }}
                              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                            >
                              Trust IP
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
          <span className="text-sm text-slate-500">
            Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} alerts
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageNumbers().map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="text-slate-600 px-1">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    p === page
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Threat Detail Modal */}
      {selectedAlert && (
        <ThreatDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  );
}
