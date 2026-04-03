import { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { UsersRound, Crown, Trash2, UserMinus, X, Copy, Check } from 'lucide-react';

export default function TeamManagement() {
  const [teams, setTeams] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [copiedPin, setCopiedPin] = useState(null);

  const load = async () => {
    try {
      const data = await adminService.getTeams();
      setTeams(data.teams);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`Delete team "${teamName}"? All members will be removed.`)) return;
    try {
      const data = await adminService.deleteTeam(teamId);
      setActionMsg(data.detail);
      load();
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to delete team.');
    }
  };

  const handleRemoveMember = async (teamId, userId, email) => {
    if (!confirm(`Remove ${email} from this team?`)) return;
    try {
      const data = await adminService.removeMember(teamId, userId);
      setActionMsg(data.detail);
      load();
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to remove member.');
    }
  };

  const handleCopyPin = (pin) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    setTimeout(() => setCopiedPin(null), 2000);
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
      <div>
        <h1 className="text-2xl font-bold text-white">Team Management</h1>
        <p className="text-sm text-slate-400 mt-1">{total} teams</p>
      </div>

      {actionMsg && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
          {actionMsg}
          <button onClick={() => setActionMsg('')} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 text-center">
          <UsersRound className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No teams have been created yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => (
            <div key={team.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              {/* Team header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <UsersRound className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{team.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {team.member_count} member{team.member_count !== 1 ? 's' : ''} — Created {new Date(team.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* PIN */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyPin(team.pin); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs font-mono text-slate-300 hover:bg-white/[0.07] transition-all cursor-pointer"
                    title="Copy PIN"
                  >
                    {team.pin}
                    {copiedPin === team.pin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id, team.name); }}
                    className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete Team"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded members */}
              {expandedTeam === team.id && (
                <div className="border-t border-white/[0.06] px-5 py-3">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-2">Member</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-2">Email</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-2">Role</th>
                        <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.members.map((m) => (
                        <tr key={m.id} className="border-b border-white/[0.04] last:border-0">
                          <td className="py-2.5 text-sm text-white">{m.name}</td>
                          <td className="py-2.5 text-sm text-slate-400">{m.email}</td>
                          <td className="py-2.5">
                            {m.is_team_leader ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400">
                                <Crown className="w-3 h-3" /> Leader
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Member</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            {!m.is_team_leader && (
                              <button
                                onClick={() => handleRemoveMember(team.id, m.id, m.email)}
                                className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                                title="Remove from team"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
