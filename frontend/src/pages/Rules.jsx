import { useState, useEffect } from 'react';
import { Workflow, Plus, Trash2, Pencil, ToggleLeft, ToggleRight, Loader2, X } from 'lucide-react';
import { alertService } from '../services/alertService';

const typeLabels = { RATE_LIMIT: 'Rate Limit', CATEGORY_MATCH: 'Category Match', FAILED_LOGIN: 'Failed Login' };
const categories = ['SQL_INJECTION', 'DDOS', 'MALWARE', 'BRUTE_FORCE', 'PORT_SCAN', 'XSS', 'COMMAND_INJECTION', 'PRIVILEGE_ESCALATION', 'DATA_EXFILTRATION', 'ANOMALY', 'OTHER'];
const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const defaultConditions = {
  RATE_LIMIT: { threshold: 10, time_window_seconds: 300, category: '' },
  CATEGORY_MATCH: { category: 'MALWARE', severity: '' },
  FAILED_LOGIN: { threshold: 5, time_window_seconds: 600 },
};
const defaultActions = { quarantine: true, auto_block: false, increase_threat_score: 0.3, notify_admin: false };

function RuleModal({ rule, onClose, onSave }) {
  const isEdit = !!rule;
  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    rule_type: rule?.rule_type || 'RATE_LIMIT',
    conditions: rule?.conditions || { ...defaultConditions.RATE_LIMIT },
    actions: rule?.actions || { ...defaultActions },
    priority: rule?.priority || 5,
    enabled: rule?.enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleTypeChange = (type) => {
    setForm({ ...form, rule_type: type, conditions: { ...defaultConditions[type] } });
  };

  const setCond = (key, value) => setForm({ ...form, conditions: { ...form.conditions, [key]: value } });
  const setAct = (key, value) => setForm({ ...form, actions: { ...form.actions, [key]: value } });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Clean empty strings from conditions
      const cleanCond = { ...form.conditions };
      Object.keys(cleanCond).forEach((k) => { if (cleanCond[k] === '') delete cleanCond[k]; });
      const payload = { ...form, conditions: cleanCond };
      if (isEdit) {
        await alertService.updateRule(rule.id, payload);
      } else {
        await alertService.createRule(payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all w-full';
  const selectClass = inputClass + ' cursor-pointer appearance-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f1320] border border-white/[0.08] rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">{isEdit ? 'Edit Rule' : 'Create Rule'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Rule Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. SQL Injection Rate Limit" className={inputClass} required />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" className={inputClass} />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Rule Type</label>
            <select value={form.rule_type} onChange={(e) => handleTypeChange(e.target.value)} className={selectClass} disabled={isEdit}>
              <option value="RATE_LIMIT">Rate Limit — trigger when IP exceeds alert count in time window</option>
              <option value="CATEGORY_MATCH">Category Match — trigger on specific category/severity combo</option>
              <option value="FAILED_LOGIN">Failed Login — trigger on brute force attempts from same IP</option>
            </select>
          </div>

          {/* Conditions */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Conditions</p>

            {form.rule_type === 'RATE_LIMIT' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Alert Threshold</label>
                    <input type="number" min="1" value={form.conditions.threshold || ''} onChange={(e) => setCond('threshold', parseInt(e.target.value) || 0)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Time Window (seconds)</label>
                    <input type="number" min="10" value={form.conditions.time_window_seconds || ''} onChange={(e) => setCond('time_window_seconds', parseInt(e.target.value) || 0)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Category Filter (optional)</label>
                  <select value={form.conditions.category || ''} onChange={(e) => setCond('category', e.target.value)} className={selectClass}>
                    <option value="">Any Category</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>
            )}

            {form.rule_type === 'CATEGORY_MATCH' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Category</label>
                  <select value={form.conditions.category || ''} onChange={(e) => setCond('category', e.target.value)} className={selectClass}>
                    <option value="">Any</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Severity</label>
                  <select value={form.conditions.severity || ''} onChange={(e) => setCond('severity', e.target.value)} className={selectClass}>
                    <option value="">Any</option>
                    {severities.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}

            {form.rule_type === 'FAILED_LOGIN' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Attempt Threshold</label>
                  <input type="number" min="1" value={form.conditions.threshold || ''} onChange={(e) => setCond('threshold', parseInt(e.target.value) || 0)} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Time Window (seconds)</label>
                  <input type="number" min="10" value={form.conditions.time_window_seconds || ''} onChange={(e) => setCond('time_window_seconds', parseInt(e.target.value) || 0)} className={inputClass} />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Actions</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.actions.quarantine || false} onChange={(e) => setAct('quarantine', e.target.checked)} className="accent-yellow-500" />
                <span className="text-sm text-slate-300">Quarantine alerts</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.actions.auto_block || false} onChange={(e) => setAct('auto_block', e.target.checked)} className="accent-red-500" />
                <span className="text-sm text-slate-300">Auto-flag IP as threat (add to blacklist)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.actions.notify_admin || false} onChange={(e) => setAct('notify_admin', e.target.checked)} className="accent-blue-500" />
                <span className="text-sm text-slate-300">Notify admin</span>
              </label>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Increase Threat Score (+)</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="1" step="0.1" value={form.actions.increase_threat_score || 0} onChange={(e) => setAct('increase_threat_score', parseFloat(e.target.value))} className="flex-1 accent-blue-500" />
                <span className="text-sm text-white font-mono w-10 text-right">+{form.actions.increase_threat_score || 0}</span>
              </div>
            </div>
          </div>

          {/* Priority + Enabled */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Priority (1-10, higher runs first)</label>
              <input type="number" min="1" max="10" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 5 })} className={inputClass} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer pb-2">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="accent-emerald-500" />
                <span className="text-sm text-slate-300">Enabled</span>
              </label>
            </div>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}

          <button type="submit" disabled={saving || !form.name.trim()} className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isEdit ? 'Update Rule' : 'Create Rule'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await alertService.getRules();
      setRules(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleToggle = async (id) => {
    try {
      await alertService.toggleRule(id);
      fetchRules();
    } catch (err) {
      setError(err.response?.data?.detail || 'Toggle failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await alertService.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed');
    }
  };

  const describeRule = (rule) => {
    const c = rule.conditions;
    if (rule.rule_type === 'RATE_LIMIT') {
      const cat = c.category ? ` ${c.category}` : '';
      return `>${c.threshold}${cat} alerts from same IP in ${c.time_window_seconds}s`;
    }
    if (rule.rule_type === 'CATEGORY_MATCH') {
      return `${c.severity || 'Any'} ${c.category || 'Any category'}`;
    }
    if (rule.rule_type === 'FAILED_LOGIN') {
      return `>${c.threshold} brute force attempts in ${c.time_window_seconds}s`;
    }
    return '';
  };

  const describeActions = (actions) => {
    const parts = [];
    if (actions.quarantine) parts.push('Quarantine');
    if (actions.auto_block) parts.push('Flag as Threat');
    if (actions.increase_threat_score) parts.push(`+${actions.increase_threat_score} score`);
    if (actions.notify_admin) parts.push('Notify');
    return parts.join(', ') || 'None';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Workflow className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Detection Rules</h1>
          <span className="text-sm text-slate-500">({rules.length} rules)</span>
        </div>
        <button
          onClick={() => { setEditRule(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>}

      {/* Rules table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Status', 'Name', 'Type', 'Condition', 'Actions', 'Priority', 'Triggers', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                    <span className="text-sm text-slate-500">Loading...</span>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">No rules created yet</td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <button onClick={() => handleToggle(rule.id)} className="cursor-pointer" title={rule.enabled ? 'Disable' : 'Enable'}>
                        {rule.enabled ? (
                          <ToggleRight className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-white font-medium">{rule.name}</p>
                      {rule.description && <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        rule.rule_type === 'RATE_LIMIT' ? 'bg-purple-500/15 text-purple-400' :
                        rule.rule_type === 'CATEGORY_MATCH' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-orange-500/15 text-orange-400'
                      }`}>{typeLabels[rule.rule_type]}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400 max-w-[200px]">{describeRule(rule)}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{describeActions(rule.actions)}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono text-center">{rule.priority}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono text-center">{rule.trigger_count}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditRule(rule); setShowModal(true); }} className="text-slate-400 hover:text-white transition-colors cursor-pointer" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(rule.id)} className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <RuleModal
          rule={editRule}
          onClose={() => { setShowModal(false); setEditRule(null); }}
          onSave={() => { setShowModal(false); setEditRule(null); fetchRules(); }}
        />
      )}
    </div>
  );
}
