import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { ShieldOff, Rocket, CreditCard, Loader2 } from 'lucide-react';

const durations = [
  { value: 1, label: '1 Month' },
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
  { value: 12, label: '12 Months' },
];

export default function DashboardLayout({ children }) {
  const { isAuthenticated, loading, user, refreshUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subStatus, setSubStatus] = useState(null); // null = loading, object = loaded
  const navigate = useNavigate();

  // Activate / renew inline state
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.tier === 'FREE' || user.is_superuser) {
      setSubStatus({ status: 'active', isNew: false });
      return;
    }
    authService.getMySubscription().then((data) => {
      if (!data.subscription) {
        setSubStatus({ status: 'none', isNew: true });
      } else {
        setSubStatus({
          status: data.subscription.status,
          end_date: data.subscription.end_date,
          start_date: data.subscription.start_date,
          isNew: false,
        });
      }
    }).catch(() => {
      setSubStatus({ status: 'active', isNew: false });
    });
  }, [isAuthenticated, user]);

  const handleActivate = async () => {
    setActivating(true);
    setActivateError('');
    try {
      // New signups activate via upgrade (creates subscription starting now)
      if (subStatus?.isNew) {
        await authService.changeTier(user.tier.toLowerCase(), selectedDuration);
      } else {
        await authService.renewSubscription(selectedDuration);
      }
      await refreshUser();
      setSubStatus({ status: 'active', isNew: false });
    } catch (err) {
      setActivateError(err.response?.data?.detail || 'Failed to activate. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Block screen for paid tiers without active subscription
  if (subStatus && subStatus.status !== 'active' && user?.tier !== 'FREE' && !user?.is_superuser) {
    const isNew = subStatus.isNew;
    const isExpired = subStatus.status === 'expired';
    const tierColor = user.tier === 'EXCLUSIVE' ? 'purple' : 'blue';
    const price = user.tier === 'EXCLUSIVE' ? 199 : 49;

    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center px-4 font-sans antialiased">
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div className="relative w-full max-w-md text-center">
          {/* Icon */}
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ${
            isNew
              ? `bg-${tierColor}-500/15 border border-${tierColor}-500/30`
              : 'bg-red-500/15 border border-red-500/30'
          }`}>
            {isNew
              ? <Rocket className={`w-8 h-8 text-${tierColor}-400`} />
              : <ShieldOff className="w-8 h-8 text-red-400" />}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-3">
            {isNew ? 'Activate Your Subscription' : 'Subscription Expired'}
          </h1>

          {/* Description */}
          <p className="text-slate-400 mb-6">
            {isNew
              ? `Welcome to DurianDetector! Choose a subscription duration to start your ${user.tier.charAt(0) + user.tier.slice(1).toLowerCase()} plan.`
              : 'Your subscription has expired. Renew to regain access to your dashboard and all features.'}
          </p>

          {/* Expired date for old users */}
          {isExpired && subStatus.end_date && (
            <p className="text-sm text-slate-500 mb-6">
              Expired on <span className="text-red-400 font-medium">{new Date(subStatus.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>
          )}

          {/* Plan info card */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6 text-left">
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm text-slate-400">Plan</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                user.tier === 'EXCLUSIVE'
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              }`}>{user.tier}</span>
            </div>

            {/* Duration picker */}
            <label className="block text-sm font-medium text-slate-300 mb-2">Choose Duration</label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {durations.map((d) => (
                <button key={d.value} type="button" onClick={() => setSelectedDuration(d.value)}
                  className={`rounded-lg px-2 py-2.5 text-center transition-all cursor-pointer text-xs font-medium ${
                    selectedDuration === d.value
                      ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                      : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:border-white/[0.1]'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>

            {/* Price summary */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <span className="text-sm text-slate-400">Total</span>
              <span className="text-lg font-bold text-white">${price * selectedDuration}</span>
            </div>
          </div>

          {activateError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
              {activateError}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleActivate}
              disabled={activating}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 cursor-pointer text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {isNew ? 'Activate Subscription' : 'Renew Subscription'}
            </button>
          </div>

          <p className="text-xs text-slate-600 mt-6">
            {isNew
              ? 'Your subscription starts immediately upon activation.'
              : 'Your data is preserved. Renew anytime to pick up where you left off.'}
          </p>
        </div>
      </div>
    );
  }

  // Still loading subscription status
  if (!subStatus && user?.tier !== 'FREE' && !user?.is_superuser) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Checking subscription...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] font-sans antialiased flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
