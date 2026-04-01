import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Plus, Trash2, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { alertService } from '../services/alertService';

export default function Whitelist() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ entry_type: 'IP', value: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await alertService.getWhitelist();
      setEntries(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch whitelist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.value.trim()) return;
    setSubmitting(true);
    try {
      await alertService.addToWhitelist(form);
      setForm({ entry_type: 'IP', value: '', reason: '' });
      setShowAdd(false);
      fetchEntries();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await alertService.removeFromWhitelist(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete entry');
    }
  };

  const handleCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim());
    const parsed = lines.map((line) => {
      const [value, entry_type, reason] = line.split(',').map((s) => s.trim());
      return { value, entry_type: entry_type || 'IP', reason: reason || 'CSV import' };
    });
    try {
      const result = await alertService.bulkImportWhitelist(parsed);
      setError(null);
      alert(`Imported: ${result.added} added, ${result.skipped} skipped`);
      fetchEntries();
    } catch (err) {
      setError(err.response?.data?.detail || 'Bulk import failed');
    }
    e.target.value = '';
  };

  const inputClass = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all w-full';
  const selectClass = inputClass + ' cursor-pointer appearance-none';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">Whitelist</h1>
          <span className="text-sm text-slate-500">({entries.length} entries)</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            Import CSV
            <input type="file" accept=".csv" ref={fileRef} onChange={handleCSV} className="hidden" />
          </label>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-sm text-white font-medium hover:bg-emerald-500 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-yellow-400 font-medium">Whitelisted IPs bypass all security checks</p>
          <p className="text-xs text-yellow-400/70 mt-0.5">Alerts from whitelisted sources will have threat_score set to 0 and skip blacklist + ThreatFox checks. Use with caution.</p>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })} className={selectClass}>
              <option value="IP">IP Address</option>
              <option value="CIDR">CIDR Range</option>
              <option value="DOMAIN">Domain</option>
            </select>
            <input
              type="text"
              placeholder={form.entry_type === 'CIDR' ? '10.0.0.0/8' : form.entry_type === 'DOMAIN' ? 'trusted.example.com' : '10.0.0.1'}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={submitting || !form.value.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-sm text-white font-medium hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Trust'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Type', 'Value', 'Reason', 'Added By', 'Trusted', 'Date', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                    <span className="text-sm text-slate-500">Loading...</span>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">No entries in whitelist</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">{entry.entry_type}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-white font-mono">{entry.value}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 max-w-[200px] truncate">{entry.reason || '—'}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">{entry.added_by}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{entry.trust_count}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove from whitelist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-600">
        CSV format: <code className="text-slate-400">value,type,reason</code> — e.g. <code className="text-slate-400">10.0.0.0/8,CIDR,Internal network</code>
      </p>
    </div>
  );
}
