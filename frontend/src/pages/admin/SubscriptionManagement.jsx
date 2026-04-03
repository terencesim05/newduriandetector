import { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { DollarSign, CreditCard, Users, Crown, UsersRound } from 'lucide-react';

const tierColors = {
  PREMIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  EXCLUSIVE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export default function SubscriptionManagement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await adminService.getSubscriptions();
        setData(d);
      } catch (err) {
        console.error('Failed to load subscriptions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const premiumCount = data?.tier_breakdown?.PREMIUM || 0;
  const exclusiveTeams = data?.tier_breakdown?.EXCLUSIVE_TEAMS || 0;

  const statCards = [
    { label: 'Monthly Revenue', value: `$${(data?.monthly_revenue || 0).toFixed(2)}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Active Subscriptions', value: data?.active_subscriptions || 0, icon: CreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Premium Users', value: `${premiumCount} x $49`, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Exclusive Teams', value: `${exclusiveTeams} x $199`, icon: Crown, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Management</h1>
        <p className="text-sm text-slate-400 mt-1">Revenue stats and ongoing subscriptions</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`${card.bg} border rounded-xl p-5`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Revenue Breakdown</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center py-4 bg-white/[0.02] rounded-lg border border-white/[0.04]">
            <p className="text-2xl font-bold text-gray-400">{data?.tier_breakdown?.FREE || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Free Users</p>
            <p className="text-xs text-gray-500 mt-0.5">$0/mo</p>
          </div>
          <div className="text-center py-4 bg-blue-500/5 rounded-lg border border-blue-500/10">
            <p className="text-2xl font-bold text-blue-400">{premiumCount}</p>
            <p className="text-sm text-slate-400 mt-1">Premium Users</p>
            <p className="text-xs text-blue-400 mt-0.5">${(premiumCount * 49).toFixed(2)}/mo</p>
          </div>
          <div className="text-center py-4 bg-purple-500/5 rounded-lg border border-purple-500/10">
            <p className="text-2xl font-bold text-purple-400">{exclusiveTeams}</p>
            <p className="text-sm text-slate-400 mt-1">Exclusive Teams</p>
            <p className="text-xs text-purple-400 mt-0.5">${(exclusiveTeams * 199).toFixed(2)}/mo</p>
          </div>
        </div>
      </div>

      {/* Ongoing Subscriptions */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Ongoing Subscriptions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Plan</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Price</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Since</th>
              </tr>
            </thead>
            <tbody>
              {(data?.ongoing_subscriptions || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No active subscriptions.</td>
                </tr>
              ) : (
                data.ongoing_subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      {sub.type === 'team' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-400">
                          <UsersRound className="w-3.5 h-3.5" />
                          Team ({sub.member_count})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400">
                          <Users className="w-3.5 h-3.5" />
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{sub.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{sub.user_email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium uppercase px-2 py-0.5 rounded-full border ${tierColors[sub.plan] || ''}`}>
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-400 font-medium">${sub.price}/mo</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(sub.start_date).toLocaleDateString()}</td>
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
