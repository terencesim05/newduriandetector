import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { User, Shield, CreditCard, Key, Check, Loader2, Eye, EyeOff, Copy, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

const toastStyle = { style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' } };

const logApi = axios.create({ baseURL: API_CONFIG.LOG_BASE_URL });
logApi.interceptors.request.use((config) => {
  const t = localStorage.getItem('accessToken');
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: CreditCard },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'security', label: 'Security', icon: Shield },
];

const tierStyles = {
  free: { border: '#9CA3AF', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
  premium: { border: '#3B82F6', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  exclusive: { border: '#A855F7', color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
};

function SecurityTab({ inputClass }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    setLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password.');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <h2 className="text-lg font-semibold text-white">Change Password</h2>
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-400">{success}</div>}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
        <div className="relative">
          <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className={inputClass} />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
        <div className="relative">
          <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className={inputClass} />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className={inputClass} />
      </div>
      <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Change Password
      </button>
    </form>
  );
}

function APIKeysTab({ inputClass }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await logApi.get('/api/api-keys');
      setKeys(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setCreating(true);
    try {
      const res = await logApi.post('/api/api-keys', { label: label.trim() });
      setNewKey(res.data.key);
      setLabel('');
      fetchKeys();
      toast.success('API key created', toastStyle);
    } catch {
      toast.error('Failed to create key', toastStyle);
    } finally { setCreating(false); }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke this API key? Any watcher using it will stop working.')) return;
    try {
      await logApi.delete(`/api/api-keys/${id}`);
      fetchKeys();
      toast.success('Key revoked', toastStyle);
    } catch {
      toast.error('Failed to revoke key', toastStyle);
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast.success('Copied to clipboard', toastStyle);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">API Keys</h2>
        <p className="text-sm text-slate-400 mt-1">Generate keys for the IDS watcher to push alerts without a browser session. Keys never expire — revoke them when no longer needed.</p>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-sm text-emerald-400 font-medium mb-2">Save this key — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 rounded px-3 py-2 text-sm text-white font-mono break-all">{newKey}</code>
            <button onClick={() => copyKey(newKey)} className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 transition-colors cursor-pointer">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-slate-500 hover:text-slate-300 mt-2 cursor-pointer transition-colors">Dismiss</button>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex items-end gap-3">
        <div className="flex-1 max-w-sm">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Label</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Production watcher" className={inputClass} />
        </div>
        <button type="submit" disabled={creating || !label.trim()} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
          Generate
        </button>
      </form>

      {/* Keys list */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-500">Loading keys...</span>
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">No API keys yet. Generate one to use with the IDS watcher.</p>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Label', 'Key', 'Last Used', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 text-sm text-white">{k.label}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 font-mono">{k.key_preview}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${k.is_active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                      {k.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {k.is_active && (
                      <button onClick={() => handleRevoke(k.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Revoke
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
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email] = useState(user?.email || '');
  const tier = (user?.tier || 'free').toLowerCase();
  const [changingTier, setChangingTier] = useState(null);
  const [tierError, setTierError] = useState('');
  const [tierSuccess, setTierSuccess] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await authService.updateProfile({ first_name: firstName.trim(), last_name: lastName.trim() });
      await refreshUser();
      toast.success('Profile saved', toastStyle);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save profile', toastStyle);
    } finally { setSavingProfile(false); }
  };

  const handleTierChange = async (newTier) => {
    const action = ['premium', 'exclusive'].indexOf(newTier) > ['premium', 'exclusive'].indexOf(tier) ? 'upgrade' : 'downgrade';
    const confirmed = window.confirm(
      `Are you sure you want to ${action} to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}?${action === 'downgrade' && tier === 'exclusive' ? '\n\nWarning: Downgrading from Exclusive will dissolve your team.' : ''}`
    );
    if (!confirmed) return;

    setChangingTier(newTier);
    setTierError('');
    setTierSuccess('');
    try {
      await authService.changeTier(newTier);
      await refreshUser();
      setTierSuccess(`Successfully ${action}d to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}!`);
    } catch (err) {
      await refreshUser();
      setTierError(err.response?.data?.detail || `Failed to ${action}. Please try again.`);
    } finally {
      setChangingTier(null);
    }
  };

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
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input type="email" value={email} readOnly className={`${inputClass} opacity-60 cursor-not-allowed`} />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
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

            {tierError && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{tierError}</div>}
            {tierSuccess && <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-400">{tierSuccess}</div>}

            <div className="grid md:grid-cols-3 gap-4">
              {/* Free */}
              <div className={`rounded-xl p-6 border transition-all ${tier === 'free' ? 'bg-gray-500/5 border-gray-400/30 ring-1 ring-gray-400/20' : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.1]'}`}>
                {tier === 'free' && <span className="inline-block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Current Plan</span>}
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Free</p>
                <div className="mt-2 flex items-baseline gap-1"><span className="text-3xl font-bold text-white">$0</span><span className="text-slate-500 text-sm">/month</span></div>
                <ul className="mt-5 space-y-2.5">
                  {['Real-time alert monitoring', 'Basic SOC dashboard', 'Up to 100 alerts/day', 'Community support'].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300"><Check className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />{item}</li>
                  ))}
                </ul>
                {tier !== 'free' ? (
                  <button onClick={() => handleTierChange('free')} disabled={changingTier === 'free'} className="w-full mt-6 border border-white/[0.08] hover:border-white/[0.15] text-slate-300 hover:text-white font-medium py-2 rounded-lg transition-all hover:bg-white/[0.05] cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {changingTier === 'free' && <Loader2 className="w-4 h-4 animate-spin" />}Downgrade
                  </button>
                ) : (
                  <div className="w-full mt-6 border border-gray-400/20 text-gray-400 font-medium py-2 rounded-lg text-sm text-center">Current Plan</div>
                )}
              </div>

              {/* Premium */}
              <div className={`relative rounded-xl p-6 border transition-all ${tier === 'premium' ? 'bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20' : 'bg-white/[0.03] border-white/[0.06] hover:border-blue-500/20'}`}>
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2"><span className="bg-blue-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">Most Popular</span></div>
                {tier === 'premium' && <span className="inline-block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Current Plan</span>}
                <p className="text-sm font-medium text-blue-400 uppercase tracking-wide">Premium</p>
                <div className="mt-2 flex items-baseline gap-1"><span className="text-3xl font-bold text-white">$49</span><span className="text-slate-500 text-sm">/month</span></div>
                <ul className="mt-5 space-y-2.5">
                  {['Everything in Free, plus:', 'ML model configurations', 'Incident management', 'PDF report generation', 'Unlimited alerts'].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300"><Check className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />{item}</li>
                  ))}
                </ul>
                {tier === 'premium' ? (
                  <div className="w-full mt-6 border border-blue-500/20 text-blue-400 font-medium py-2 rounded-lg text-sm text-center">Current Plan</div>
                ) : tier === 'exclusive' ? (
                  <button onClick={() => handleTierChange('premium')} disabled={changingTier === 'premium'} className="w-full mt-6 border border-white/[0.08] hover:border-white/[0.15] text-slate-300 hover:text-white font-medium py-2 rounded-lg transition-all hover:bg-white/[0.05] cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {changingTier === 'premium' && <Loader2 className="w-4 h-4 animate-spin" />}Downgrade
                  </button>
                ) : (
                  <button onClick={() => handleTierChange('premium')} disabled={changingTier === 'premium'} className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {changingTier === 'premium' && <Loader2 className="w-4 h-4 animate-spin" />}Upgrade to Premium
                  </button>
                )}
              </div>

              {/* Exclusive */}
              <div className={`rounded-xl p-6 border transition-all ${tier === 'exclusive' ? 'bg-purple-500/5 border-purple-500/30 ring-1 ring-purple-500/20' : 'bg-white/[0.03] border-white/[0.06] hover:border-purple-500/20'}`}>
                {tier === 'exclusive' && <span className="inline-block text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3">Current Plan</span>}
                <p className="text-sm font-medium text-purple-400 uppercase tracking-wide">Exclusive</p>
                <div className="mt-2 flex items-baseline gap-1"><span className="text-3xl font-bold text-white">$199</span><span className="text-slate-500 text-sm">/month</span></div>
                <ul className="mt-5 space-y-2.5">
                  {['Everything in Premium, plus:', 'AI-driven analysis', 'Team workspace (5 members)', 'Custom alert rules', 'Dedicated support'].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300"><Check className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" />{item}</li>
                  ))}
                </ul>
                {tier === 'exclusive' ? (
                  <div className="w-full mt-6 border border-purple-500/20 text-purple-400 font-medium py-2 rounded-lg text-sm text-center">Current Plan</div>
                ) : (
                  <button onClick={() => handleTierChange('exclusive')} disabled={changingTier === 'exclusive'} className="w-full mt-6 bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 rounded-lg transition-all shadow-lg shadow-purple-600/20 hover:shadow-purple-500/30 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {changingTier === 'exclusive' && <Loader2 className="w-4 h-4 animate-spin" />}Upgrade to Exclusive
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api-keys' && <APIKeysTab inputClass={inputClass} />}

        {activeTab === 'security' && <SecurityTab inputClass={inputClass} />}
      </div>
    </div>
  );
}
