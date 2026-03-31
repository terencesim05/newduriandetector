import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';

const statusColors = {
  Open: 'bg-red-500/15 text-red-400 border-red-500/30',
  'In Progress': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Closed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const priorityColors = {
  Critical: 'text-red-400',
  High: 'text-orange-400',
  Medium: 'text-yellow-400',
  Low: 'text-slate-400',
};

const mockIncidents = [
  {
    id: 'INC-001',
    title: 'Suspected SQL Injection Attack on Production DB',
    status: 'Open',
    priority: 'Critical',
    assignedTo: 'John Doe',
    created: 'Mar 31, 2026 — 14:32',
    description:
      'Multiple SQL injection attempts detected from 192.168.1.105 targeting the production database. WAF rules triggered 47 times in 10 minutes.',
  },
  {
    id: 'INC-002',
    title: 'DDoS Attack on API Gateway',
    status: 'In Progress',
    priority: 'High',
    assignedTo: 'Jane Smith',
    created: 'Mar 31, 2026 — 12:15',
    description:
      'Volumetric DDoS attack detected on the API gateway. Traffic spike of 50x normal volume. Rate limiting engaged.',
  },
  {
    id: 'INC-003',
    title: 'Malware Communication Detected',
    status: 'Open',
    priority: 'High',
    assignedTo: 'Mike Chen',
    created: 'Mar 30, 2026 — 23:45',
    description:
      'Host 10.0.1.12 detected communicating with known C2 server. Endpoint isolated pending investigation.',
  },
  {
    id: 'INC-004',
    title: 'Brute Force Attempt on SSH',
    status: 'Resolved',
    priority: 'Medium',
    assignedTo: 'Sarah Kim',
    created: 'Mar 30, 2026 — 18:20',
    description:
      'Over 500 failed SSH login attempts from 10.0.2.34. Source IP has been blocked. No successful authentications detected.',
  },
  {
    id: 'INC-005',
    title: 'XSS Vulnerability Exploited',
    status: 'Closed',
    priority: 'Low',
    assignedTo: 'John Doe',
    created: 'Mar 29, 2026 — 09:10',
    description:
      'Reflected XSS payload detected in search parameter. Patch deployed and verified. No data exfiltration confirmed.',
  },
];

export default function Incidents() {
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const filtered =
    statusFilter === 'All'
      ? mockIncidents
      : mockIncidents.filter((inc) => inc.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Incidents</h1>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer">
          <Plus className="w-4 h-4" />
          Create New Incident
        </button>
      </div>

      {/* Filter */}
      <div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none"
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* Incident cards */}
      <div className="space-y-3">
        {filtered.map((inc) => {
          const isExpanded = expandedId === inc.id;
          return (
            <div
              key={inc.id}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-white/[0.1] transition-all"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                className="w-full flex items-center justify-between px-5 py-4 cursor-pointer text-left"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xs font-mono text-slate-500 shrink-0">{inc.id}</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{inc.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span
                        className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColors[inc.status]}`}
                      >
                        {inc.status}
                      </span>
                      <span className={`text-xs font-medium ${priorityColors[inc.priority]}`}>
                        {inc.priority}
                      </span>
                    </div>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-3">
                  <p className="text-sm text-slate-400 leading-relaxed">{inc.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {inc.assignedTo}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {inc.created}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No incidents match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
