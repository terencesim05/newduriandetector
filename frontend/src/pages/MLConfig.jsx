import { useState, useEffect } from 'react';
import { BrainCircuit, Loader2, Save, ToggleLeft, ToggleRight, ArrowUpCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { alertService } from '../services/alertService';

const modelOptions = [
  { value: 'random_forest', label: 'Random Forest', desc: 'Fast, interpretable ensemble of decision trees — good baseline for structured alert data' },
  { value: 'isolation_forest', label: 'Isolation Forest', desc: 'Unsupervised anomaly detection — finds outliers without labeled data, good for zero-day threats' },
  { value: 'neural_network', label: 'Neural Network', desc: 'Multi-layer perceptron that learns non-linear feature relationships for advanced detection' },
];

export default function MLConfig() {
  const { user } = useAuth();
  const tier = (user?.tier || 'free').toUpperCase();
  const isPremiumOrExclusive = ['PREMIUM', 'EXCLUSIVE'].includes(tier);

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Draft state for unsaved changes
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!isPremiumOrExclusive) {
      setLoading(false);
      return;
    }
    async function fetchConfig() {
      setLoading(true);
      try {
        const data = await alertService.getMLConfig();
        setConfig(data);
        setDraft(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load ML configuration');
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [isPremiumOrExclusive]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await alertService.updateMLConfig({
        model_type: draft.model_type,
        enabled: draft.enabled,
        confidence_threshold: draft.confidence_threshold,
        sensitivity: draft.sensitivity,
        score_boost: draft.score_boost,
      });
      setConfig(updated);
      setDraft(updated);
      setSuccess('ML configuration saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = draft && config && (
    draft.model_type !== config.model_type ||
    draft.enabled !== config.enabled ||
    draft.confidence_threshold !== config.confidence_threshold ||
    draft.sensitivity !== config.sensitivity ||
    draft.score_boost !== config.score_boost
  );

  const inputClass = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all w-full';

  // FREE users see upgrade prompt
  if (!isPremiumOrExclusive) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">ML Configuration</h1>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <ArrowUpCircle className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Upgrade Required</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            ML threat detection configuration is available on Premium and Exclusive plans.
            Upgrade to customize model settings, adjust sensitivity, and fine-tune threat scoring.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-sm text-white font-medium hover:bg-purple-500 transition-colors"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Upgrade Plan
          </a>
        </div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">ML Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraft({ ...draft, model_type: 'random_forest', enabled: true, sensitivity: 0.8, score_boost: 0.2, confidence_threshold: 0.7 })}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-slate-400 font-medium hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm text-emerald-400">{success}</div>
      )}

      {draft && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Enable/Disable + Model Selection */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Model Settings</p>

            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">ML Predictions</p>
                <p className="text-xs text-slate-500 mt-0.5">Enable or disable ML threat scoring on ingested alerts</p>
              </div>
              <button
                onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
                className="cursor-pointer"
              >
                {draft.enabled ? (
                  <ToggleRight className="w-8 h-8 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>

            {/* Model type */}
            <div>
              <label className="text-xs text-slate-500 mb-2 block">Model Type</label>
              <div className="space-y-2">
                {modelOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      draft.model_type === opt.value
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="model_type"
                      value={opt.value}
                      checked={draft.model_type === opt.value}
                      onChange={(e) => setDraft({ ...draft, model_type: e.target.value })}
                      className="accent-purple-500 mt-0.5"
                    />
                    <div>
                      <p className="text-sm text-white font-medium">{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Sensitivity & Thresholds */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Sensitivity & Thresholds</p>

            {/* Sensitivity */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-white font-medium">Sensitivity</p>
                  <p className="text-xs text-slate-500 mt-0.5">ML confidence above this triggers a score boost</p>
                </div>
                <span className="text-sm text-purple-400 font-mono font-medium">{draft.sensitivity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={draft.sensitivity}
                onChange={(e) => setDraft({ ...draft, sensitivity: parseFloat(e.target.value) })}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>More aggressive (0.50)</span>
                <span>More conservative (0.95)</span>
              </div>
            </div>

            {/* Score boost */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-white font-medium">Score Boost</p>
                  <p className="text-xs text-slate-500 mt-0.5">Amount added to threat_score when ML flags an alert</p>
                </div>
                <span className="text-sm text-purple-400 font-mono font-medium">+{draft.score_boost.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={draft.score_boost}
                onChange={(e) => setDraft({ ...draft, score_boost: parseFloat(e.target.value) })}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>Gentle (+0.05)</span>
                <span>Aggressive (+0.50)</span>
              </div>
            </div>

            {/* Confidence threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-white font-medium">Confidence Threshold</p>
                  <p className="text-xs text-slate-500 mt-0.5">Minimum ML confidence to show "ML-flagged" badge</p>
                </div>
                <span className="text-sm text-purple-400 font-mono font-medium">{draft.confidence_threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="0.9"
                step="0.05"
                value={draft.confidence_threshold}
                onChange={(e) => setDraft({ ...draft, confidence_threshold: parseFloat(e.target.value) })}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>Show more (0.30)</span>
                <span>Show fewer (0.90)</span>
              </div>
            </div>
          </div>

          {/* Info panel */}
          <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">How It Works</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-sm text-white font-medium mb-1">1. Predict</p>
                <p className="text-xs text-slate-400">
                  Every ingested alert is scored by the ML model, producing a confidence value (0.0 - 1.0).
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-sm text-white font-medium mb-1">2. Boost</p>
                <p className="text-xs text-slate-400">
                  If confidence exceeds the <span className="text-purple-400">sensitivity</span> threshold, the alert's threat_score
                  is increased by the <span className="text-purple-400">score boost</span> amount.
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-sm text-white font-medium mb-1">3. Act</p>
                <p className="text-xs text-slate-400">
                  Boosted scores can push alerts into quarantine (0.7+) or auto-block (0.9+), same as rule-based scoring.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
