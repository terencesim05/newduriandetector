import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, X, Trash2, ShieldBan, ShieldCheck, ExternalLink, UserPlus, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { alertService } from '../services/alertService';
import { useAuth } from '../context/AuthContext';

const severityColors = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const severityDot = {
  CRITICAL: 'bg-red-400',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-slate-400',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function LiveAlertFeed({ alerts, connected, onDismiss, onDismissAll }) {
  const { user } = useAuth();
  const listRef = useRef(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assigningId, setAssigningId] = useState(null);
  const [assignedAlerts, setAssignedAlerts] = useState({});

  const isTeamLeader = user?.is_team_leader && user?.team_id;

  useEffect(() => {
    if (isTeamLeader) {
      import('../services/authService').then(({ authService }) => {
        authService.getMyTeam().then((team) => {
          if (team?.members) setTeamMembers(team.members);
        }).catch(() => {});
      });
    }
  }, [isTeamLeader]);

  const handleAssign = async (alert, memberId) => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) return;
    const name = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email;
    try {
      await alertService.assignAlert(alert.id, memberId, name);
      setAssignedAlerts((prev) => ({ ...prev, [alert.id]: name }));
      setAssigningId(null);
      toast.success(`Assigned to ${name}`, { style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(59,130,246,0.3)' } });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign', { style: { background: '#1e1e2e', color: '#fff' } });
    }
  };

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [alerts.length]);

  const handleBlock = async (alert) => {
    try {
      await alertService.addToBlacklist({ entry_type: 'IP', value: alert.source_ip, reason: `Flagged from live feed — ${alert.category}` });
      toast.success(`Flagged ${alert.source_ip}`, { style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' } });
      if (onDismiss) onDismiss(alert.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to flag IP', { style: { background: '#1e1e2e', color: '#fff' } });
    }
  };

  const handleTrust = async (alert) => {
    try {
      await alertService.addToWhitelist({ entry_type: 'IP', value: alert.source_ip, reason: `Trusted from live feed` });
      toast.success(`Trusted ${alert.source_ip}`, { style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(16,185,129,0.3)' } });
      if (onDismiss) onDismiss(alert.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to trust IP', { style: { background: '#1e1e2e', color: '#fff' } });
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-white">Live Alert Feed</h2>
          {alerts.length > 0 && (
            <span className="text-xs text-slate-500">({alerts.length})</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/alerts"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all
            <ExternalLink className="w-3 h-3" />
          </Link>
          {alerts.length > 0 && onDismissAll && (
            <button
              onClick={onDismissAll}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
              title="Clear all"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <Radio className="w-3 h-3" />
              Disconnected
            </span>
          )}
        </div>
      </div>

      <div ref={listRef} className="max-h-[500px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Radio className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {connected ? 'Waiting for alerts...' : 'Connect to see live alerts'}
            </p>
          </div>
        ) : (
          <div>
            {alerts.map((alert, i) => (
              <div
                key={alert.id || i}
                className="group px-5 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-all animate-[fadeIn_0.3s_ease-in]"
              >
                {/* Top row: severity + category + time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${severityDot[alert.severity] || severityDot.LOW}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${severityColors[alert.severity] || severityColors.LOW}`}>
                          {alert.severity}
                        </span>
                        <span className="text-sm text-slate-300 font-mono">{alert.category}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        {alert.source_ip} → {alert.destination_ip}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{timeAgo(alert.created_at)}</span>
                    {onDismiss && (
                      <button
                        onClick={() => onDismiss(alert.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 cursor-pointer transition-all"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Threat score */}
                {alert.threat_score >= 0.7 && (
                  <p className="text-xs text-red-400 font-medium mt-1 ml-5 pl-3">
                    Threat Score: {alert.threat_score?.toFixed(2)}
                  </p>
                )}

                {/* Action buttons — always visible */}
                <div className="flex items-center gap-2 mt-2 ml-5 pl-3">
                  <button
                    onClick={() => handleBlock(alert)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer text-xs font-medium"
                  >
                    <ShieldBan className="w-3.5 h-3.5" />
                    Flag as Threat
                  </button>
                  <button
                    onClick={() => handleTrust(alert)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer text-xs font-medium"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Trust IP
                  </button>
                  {isTeamLeader ? (
                    assignedAlerts[alert.id] || alert.assigned_name ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                        <UserCheck className="w-3.5 h-3.5" />
                        {assignedAlerts[alert.id] || alert.assigned_name}
                      </span>
                    ) : assigningId === alert.id ? (
                      <select
                        autoFocus
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleAssign(alert, parseInt(e.target.value));
                        }}
                        onBlur={() => setAssigningId(null)}
                        className="bg-white/[0.04] border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none cursor-pointer appearance-none"
                      >
                        <option value="">Select member...</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>{m.first_name || m.email}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setAssigningId(alert.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer text-xs font-medium"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Assign
                      </button>
                    )
                  ) : (alert.assigned_to === user?.id || assignedAlerts[alert.id]) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
                      <UserCheck className="w-3.5 h-3.5" />
                      Assigned to you
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
