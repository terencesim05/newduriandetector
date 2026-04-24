import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Ban,
  CheckCircle,
  KeyRound,
  ArrowUpDown,
  X,
} from 'lucide-react';

const tierColors = {
  FREE: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  PREMIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  EXCLUSIVE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [changeTierUser, setChangeTierUser] = useState(null);
  const [newTier, setNewTier] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { type, user, executing }

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getUsers({
        search,
        tier: tierFilter,
        status: statusFilter,
        page,
      });
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter, statusFilter, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleViewDetail = async (userId) => {
    setDetailLoading(true);
    try {
      const data = await adminService.getUserDetail(userId);
      setSelectedUser(data);
    } catch (err) {
      console.error('Failed to load user detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const { type, user: targetUser } = confirmAction;
    setConfirmAction((prev) => ({ ...prev, executing: true }));
    try {
      if (type === 'suspend') {
        const data = await adminService.suspendUser(targetUser.id);
        setActionMsg(data.detail);
      } else if (type === 'unsuspend') {
        const data = await adminService.unsuspendUser(targetUser.id);
        setActionMsg(data.detail);
      } else if (type === 'reset_password') {
        const data = await adminService.resetPassword(targetUser.id);
        setActionMsg(data.detail);
      }
      loadUsers();
      setSelectedUser(null);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || `Failed to ${type.replace('_', ' ')}.`);
    } finally {
      setConfirmAction(null);
    }
  };

  const handleChangeTier = async () => {
    if (!changeTierUser || !newTier) return;
    try {
      const data = await adminService.changeTier(changeTierUser.id, newTier);
      setActionMsg(data.detail);
      setChangeTierUser(null);
      setNewTier('');
      loadUsers();
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to change tier.');
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-sm text-slate-400 mt-1">{total} total users</p>
      </div>

      {actionMsg && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
          {actionMsg}
          <button onClick={() => setActionMsg('')} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 flex-1 min-w-[250px]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or username..."
            className="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-full"
          />
        </form>

        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none cursor-pointer"
        >
          <option value="">All Tiers</option>
          <option value="FREE">Free</option>
          <option value="PREMIUM">Premium</option>
          <option value="EXCLUSIVE">Exclusive</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Tier</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Joined</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No users found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-white">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium uppercase px-2 py-0.5 rounded-full border ${tierColors[u.tier] || tierColors.FREE}`}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(u.date_joined || u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleViewDetail(u.id)} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-blue-400 transition-colors cursor-pointer" title="View Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        {u.is_active ? (
                          <button onClick={() => setConfirmAction({ type: 'suspend', user: u })} className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer" title="Suspend">
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => setConfirmAction({ type: 'unsuspend', user: u })} className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer" title="Unsuspend">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => { setChangeTierUser(u); setNewTier(u.tier); }} className="p-1.5 rounded hover:bg-purple-500/10 text-slate-400 hover:text-purple-400 transition-colors cursor-pointer" title="Change Tier">
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirmAction({ type: 'reset_password', user: u })} className="p-1.5 rounded hover:bg-yellow-500/10 text-slate-400 hover:text-yellow-400 transition-colors cursor-pointer" title="Reset Password">
                          <KeyRound className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-sm text-slate-400">Page {page} of {totalPages} ({total} users)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-[#0d1221] border border-white/[0.08] rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  ['Email', selectedUser.email],
                  ['Username', selectedUser.username],
                  ['Name', `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || '—'],
                  ['Tier', selectedUser.tier],
                  ['Status', selectedUser.is_active ? 'Active' : 'Suspended'],
                  ['Superuser', selectedUser.is_superuser ? 'Yes' : 'No'],
                  ['Team Leader', selectedUser.is_team_leader ? 'Yes' : 'No'],
                  ['Joined', new Date(selectedUser.date_joined || selectedUser.created_at).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-white/[0.04]">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className="text-sm text-white">{value}</span>
                  </div>
                ))}

                {selectedUser.subscription && (
                  <>
                    <h4 className="text-sm font-semibold text-white mt-4">Subscription</h4>
                    {[
                      ['Plan', selectedUser.subscription.plan],
                      ['Price', `$${selectedUser.subscription.price_monthly}/mo`],
                      ['Started', new Date(selectedUser.subscription.start_date).toLocaleDateString()],
                      ['Auto-Renew', selectedUser.subscription.auto_renew ? 'Yes' : 'No'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between py-2 border-b border-white/[0.04]">
                        <span className="text-sm text-slate-400">{label}</span>
                        <span className="text-sm text-white">{value}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !confirmAction.executing && setConfirmAction(null)}>
          <div className="bg-[#0d1221] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">
              {confirmAction.type === 'suspend' && 'Suspend User'}
              {confirmAction.type === 'unsuspend' && 'Unsuspend User'}
              {confirmAction.type === 'reset_password' && 'Reset Password'}
            </h3>
            <p className="text-sm text-slate-400 mb-1">
              {confirmAction.type === 'suspend' && 'This will prevent the user from logging in.'}
              {confirmAction.type === 'unsuspend' && 'This will restore the user\'s access.'}
              {confirmAction.type === 'reset_password' && 'A temporary password will be generated and emailed to the user.'}
            </p>
            <p className="text-sm text-white mb-5">
              {confirmAction.user.email}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={confirmAction.executing}
                className="flex-1 border border-white/[0.08] text-slate-300 py-2 rounded-lg text-sm hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                disabled={confirmAction.executing}
                className={`flex-1 text-white py-2 rounded-lg text-sm transition-all cursor-pointer disabled:opacity-50 ${
                  confirmAction.type === 'suspend' || confirmAction.type === 'reset_password'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {confirmAction.executing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Tier Modal */}
      {changeTierUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setChangeTierUser(null)}>
          <div className="bg-[#0d1221] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Change Tier</h3>
            <p className="text-sm text-slate-400 mb-4">
              Change tier for <span className="text-white">{changeTierUser.email}</span>
            </p>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white outline-none mb-4 cursor-pointer"
            >
              <option value="FREE">Free</option>
              <option value="PREMIUM">Premium</option>
              <option value="EXCLUSIVE">Exclusive</option>
            </select>
            <div className="flex gap-3">
              <button onClick={() => setChangeTierUser(null)} className="flex-1 border border-white/[0.08] text-slate-300 py-2 rounded-lg text-sm hover:bg-white/[0.05] transition-all cursor-pointer">
                Cancel
              </button>
              <button onClick={handleChangeTier} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm transition-all cursor-pointer">
                Change Tier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
