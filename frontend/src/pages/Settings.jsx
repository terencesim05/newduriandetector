import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, CreditCard, Check } from 'lucide-react';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Shield },
];

const tierStyles = {
  free: { border: '#9CA3AF', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
  premium: { border: '#3B82F6', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  exclusive: { border: '#A855F7', color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
};

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email] = useState(user?.email || '');
  const tier = (user?.tier || 'free').toLowerCase();

  const inputClass =
    'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === id
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        {activeTab === 'profile' && (
          <div className="space-y-5 max-w-lg">
            <h2 className="text-lg font-semibold text-white">Profile Settings</h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className={`${inputClass} opacity-60 cursor-not-allowed`}
              />
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer">
              Save Changes
            </button>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Account</h2>
              <p className="text-sm text-slate-400 mt-1">Manage your subscription plan</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* Free */}
              <div className={`rounded-xl p-6 border transition-all ${tier === 'free' ? 'bg-gray-500/5 border-gray-400/30 ring-1 ring-gray-400/20' : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.1]'}`}>
                {tier === 'free' && <span className="inline-block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Current Plan</span>}
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Free</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">$0</span>
                  <span className="text-slate-500 text-sm">/month</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {['Real-time alert monitoring', 'Basic SOC dashboard', 'Up to 100 alerts/day', 'Community support'].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                {tier !== 'free' ? (
                  <button className="w-full mt-6 border border-white/[0.08] hover:border-white/[0.15] text-slate-300 hover:text-white font-medium py-2 rounded-lg transition-all hover:bg-white/[0.05] cursor-pointer text-sm">
                    Downgrade
                  </button>
                ) : (
                  <div className="w-full mt-6 border border-gray-400/20 text-gray-400 font-medium py-2 rounded-lg text-sm text-center">
                    Current Plan
                  </div>
                )}
              </div>

              {/* Premium */}
              <div className={`relative rounded-xl p-6 border transition-all ${tier === 'premium' ? 'bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20' : 'bg-white/[0.03] border-white/[0.06] hover:border-blue-500/20'}`}>
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">Most Popular</span>
                </div>
                {tier === 'premium' && <span className="inline-block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Current Plan</span>}
                <p className="text-sm font-medium text-blue-400 uppercase tracking-wide">Premium</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">$49</span>
                  <span className="text-slate-500 text-sm">/month</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {['Everything in Free, plus:', 'ML model configurations', 'Incident management', 'PDF report generation', 'Unlimited alerts'].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                {tier === 'premium' ? (
                  <div className="w-full mt-6 border border-blue-500/20 text-blue-400 font-medium py-2 rounded-lg text-sm text-center">
                    Current Plan
                  </div>
                ) : tier === 'exclusive' ? (
                  <button className="w-full mt-6 border border-white/[0.08] hover:border-white/[0.15] text-slate-300 hover:text-white font-medium py-2 rounded-lg transition-all hover:bg-white/[0.05] cursor-pointer text-sm">
                    Downgrade
                  </button>
                ) : (
                  <button className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 cursor-pointer text-sm">
                    Upgrade to Premium
                  </button>
                )}
              </div>

              {/* Exclusive */}
              <div className={`rounded-xl p-6 border transition-all ${tier === 'exclusive' ? 'bg-purple-500/5 border-purple-500/30 ring-1 ring-purple-500/20' : 'bg-white/[0.03] border-white/[0.06] hover:border-purple-500/20'}`}>
                {tier === 'exclusive' && <span className="inline-block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3">Current Plan</span>}
                <p className="text-sm font-medium text-purple-400 uppercase tracking-wide">Exclusive</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">$199</span>
                  <span className="text-slate-500 text-sm">/month</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {['Everything in Premium, plus:', '3D attack globe', 'AI-driven analysis', 'Team workspace (5 members)', 'Custom alert rules', 'Dedicated support'].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                {tier === 'exclusive' ? (
                  <div className="w-full mt-6 border border-purple-500/20 text-purple-400 font-medium py-2 rounded-lg text-sm text-center">
                    Current Plan
                  </div>
                ) : (
                  <button className="w-full mt-6 bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 rounded-lg transition-all shadow-lg shadow-purple-600/20 hover:shadow-purple-500/30 cursor-pointer text-sm">
                    Upgrade to Exclusive
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-5 max-w-lg">
            <h2 className="text-lg font-semibold text-white">Security</h2>
            <div>
              <button className="border border-white/[0.08] hover:border-white/[0.12] text-slate-300 hover:text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all hover:bg-white/[0.05] cursor-pointer">
                Change Password
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
