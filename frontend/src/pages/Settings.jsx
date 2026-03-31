import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Bell, CreditCard } from 'lucide-react';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const tierColors = {
  free: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  premium: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  exclusive: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email] = useState(user?.email || '');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [severityThreshold, setSeverityThreshold] = useState(50);
  const [twoFA, setTwoFA] = useState(false);

  const tier = user?.tier || 'free';

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
          <div className="space-y-5 max-w-lg">
            <h2 className="text-lg font-semibold text-white">Account</h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Current Tier</label>
              <span
                className={`inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded border ${tierColors[tier]}`}
              >
                {tier}
              </span>
            </div>
            {tier === 'free' && (
              <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer">
                Upgrade to Premium
              </button>
            )}
            {tier === 'premium' && (
              <button className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-amber-600/20 cursor-pointer">
                Upgrade to Exclusive
              </button>
            )}
            {tier === 'exclusive' && (
              <p className="text-sm text-emerald-400">
                You have full platform access with your Exclusive plan.
              </p>
            )}
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
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
                <p className="text-xs text-slate-500 mt-0.5">Add an extra layer of security to your account</p>
              </div>
              <button
                onClick={() => setTwoFA(!twoFA)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  twoFA ? 'bg-blue-600' : 'bg-white/[0.1]'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    twoFA ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-5 max-w-lg">
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Email Notifications</p>
                <p className="text-xs text-slate-500 mt-0.5">Receive alert summaries via email</p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  emailNotifications ? 'bg-blue-600' : 'bg-white/[0.1]'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    emailNotifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-white">Alert Severity Threshold</p>
                <span className="text-sm text-blue-400 font-medium">{severityThreshold}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={severityThreshold}
                onChange={(e) => setSeverityThreshold(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between mt-1 text-xs text-slate-600">
                <span>Low</span>
                <span>Critical</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
