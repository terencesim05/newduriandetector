import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { alertService } from '../services/alertService';
import { Users, Key, Copy, Check, Crown, UserPlus, Shield, Loader2, RefreshCw, Activity, Bell } from 'lucide-react';

const MAX_TEAM_MEMBERS = 4;

export default function Teams() {
  const { user } = useAuth();
  const tier = user?.tier?.toUpperCase() || 'FREE';
  const [copied, setCopied] = useState(false);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activity, setActivity] = useState([]);
  const [teamStats, setTeamStats] = useState(null);

  useEffect(() => {
    if (tier === 'EXCLUSIVE') {
      fetchTeam();
      fetchTeamData();
    } else {
      setLoading(false);
    }
  }, [tier]);

  const fetchTeamData = async () => {
    try {
      const [actData, statsData] = await Promise.all([
        alertService.getTeamActivity(20),
        alertService.getTeamStats(),
      ]);
      setActivity(actData);
      setTeamStats(statsData);
    } catch {}
  };

  const fetchTeam = async () => {
    try {
      const response = await authService.getMyTeam();
      setTeam(response);
    } catch {
      setTeam(null);
    } finally {
      setLoading(false);
    }
  };

  // Only Exclusive users can access teams
  if (tier !== 'EXCLUSIVE') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Shield className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Exclusive Feature</h2>
        <p className="text-sm text-slate-400 text-center max-w-sm">
          Team collaboration is available on the Exclusive plan. Upgrade to create a team and invite up to {MAX_TEAM_MEMBERS} members.
        </p>
        <a
          href="/settings"
          className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-purple-600/20"
        >
          Upgrade to Exclusive
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  const handleCopyPin = () => {
    if (team?.pin) {
      navigator.clipboard.writeText(team.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      await authService.createTeam(teamName.trim());
      await fetchTeam();
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  };

  const handleRegeneratePin = async () => {
    if (!team) return;
    setRegenerating(true);
    try {
      await authService.regeneratePin(team.id);
      await fetchTeam();
    } catch {
      // handle error
    } finally {
      setRegenerating(false);
    }
  };

  // Separate leader and members from the team members list
  const leader = team?.members?.find((m) => m.is_team_leader);
  const members = team?.members?.filter((m) => !m.is_team_leader) || [];
  const slotsRemaining = MAX_TEAM_MEMBERS - members.length;

  // No team yet — show create form
  if (!team) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Teams</h1>
        <div className="max-w-md mx-auto py-12">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Create Your Team</h2>
              <p className="text-sm text-slate-400 mt-1">
                As the team leader, you can invite up to {MAX_TEAM_MEMBERS} members using a generated PIN.
              </p>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. SOC Alpha"
                  required
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create Team & Generate PIN'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Has team — show team dashboard
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Teams</h1>
        {user?.is_team_leader && (
          <div className="flex items-center gap-2 text-sm text-purple-400">
            <Crown className="w-4 h-4" />
            Team Leader
          </div>
        )}
      </div>

      {/* Team info + PIN */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              {team.name}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {members.length}/{MAX_TEAM_MEMBERS} members &middot; {slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} remaining
            </p>
          </div>

          {/* PIN display — only for leader */}
          {user?.is_team_leader && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-base font-semibold text-white tracking-widest">{team.pin}</span>
              </div>
              <button
                onClick={handleCopyPin}
                className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all cursor-pointer"
                title="Copy PIN"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
              <button
                onClick={handleRegeneratePin}
                disabled={regenerating}
                className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all cursor-pointer disabled:opacity-50"
                title="Regenerate PIN"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${regenerating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {user?.is_team_leader && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
            <p className="text-xs text-amber-300/80">
              Share this PIN with team members. They'll enter it during Exclusive signup to join your team. Maximum {MAX_TEAM_MEMBERS} members allowed.
            </p>
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-base font-semibold text-white">Team Members</h3>
          <span className="text-xs text-slate-500">{members.length} of {MAX_TEAM_MEMBERS}</span>
        </div>

        {/* Leader row */}
        {leader && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-purple-500/[0.03]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                {(leader.first_name?.[0] || 'L').toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {leader.first_name ? `${leader.first_name} ${leader.last_name || ''}`.trim() : leader.email}
                </p>
                <p className="text-xs text-slate-500">{leader.email}</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-purple-400">
              <Crown className="w-3 h-3" />
              Leader
            </span>
          </div>
        )}

        {/* Member rows */}
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {(member.first_name?.[0] || 'M').toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {member.first_name ? `${member.first_name} ${member.last_name || ''}`.trim() : member.email}
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Joined {new Date(member.created_at).toLocaleDateString()}
              </span>
              {user?.is_team_leader && (
                <button className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer">Remove</button>
              )}
            </div>
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: slotsRemaining }).map((_, i) => (
          <div key={`empty-${i}`} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-0">
            <div className="w-8 h-8 rounded-full border border-dashed border-white/[0.1] flex items-center justify-center">
              <UserPlus className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <span className="text-sm text-slate-600">Open slot — share PIN to invite</span>
          </div>
        ))}
      </div>

      {/* Team Stats */}
      {teamStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Alerts</p>
            <p className="text-2xl font-bold text-white">{teamStats.total_alerts}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Unassigned</p>
            <p className="text-2xl font-bold text-yellow-400">{teamStats.unassigned}</p>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      {activity.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-base font-semibold text-white">Recent Activity</h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0 mt-0.5">
                  {(a.user_name?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-300">
                    <span className="text-white font-medium">{a.user_name}</span>{' '}
                    <span className="text-slate-500">{a.action.replace(/_/g, ' ')}</span>
                  </p>
                  {a.details && <p className="text-xs text-slate-500 mt-0.5 truncate">{a.details}</p>}
                  <p className="text-xs text-slate-600 mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
