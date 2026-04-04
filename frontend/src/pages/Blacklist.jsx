import { useState, useEffect, useRef } from 'react';
import { ShieldBan, Plus, Trash2, Upload, Loader2, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { alertService } from '../services/alertService';

function exportFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toSuricataRules(entries) {
  return entries
    .filter((e) => e.entry_type === 'IP')
    .map((e) => `drop ip ${e.value} any -> any any (msg:"Blocked by DurianDetector — ${(e.reason || '').replace(/"/g, '\\"')}"; sid:${Math.floor(Math.random() * 900000) + 100000}; rev:1;)`)
    .join('\n');
}

function toSnortReputation(entries) {
  return entries
    .filter((e) => e.entry_type === 'IP')
    .map((e) => e.value)
    .join('\n');
}

function toZeekIntel(entries) {
  const header = '#fields\tindicator\tindicator_type\tmeta.source\tmeta.desc';
  const rows = entries
    .filter((e) => e.entry_type === 'IP')
    .map((e) => `${e.value}\tIntel::ADDR\tDurianDetector\t${e.reason || 'Blacklisted'}`);
  return [header, ...rows].join('\n');
}

export default function Blacklist() {
  const { user } = useAuth();
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
      const data = await alertService.getBlacklist();
      setEntries(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch blacklist');
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
      await alertService.addToBlacklist(form);
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
      await alertService.removeFromBlacklist(id);
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
      const result = await alertService.bulkImportBlacklist(parsed);
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
          <ShieldBan className="w-6 h-6 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Blacklist</h1>
          <span className="text-sm text-slate-500">({entries.length} entries)</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['PREMIUM', 'EXCLUSIVE'].includes(user?.tier?.toUpperCase()) && entries.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => exportFile(toSuricataRules(entries), 'blacklist-suricata.rules')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Suricata
              </button>
              <button
                onClick={() => exportFile(toSnortReputation(entries), 'blacklist-snort.txt')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Snort
              </button>
              <button
                onClick={() => exportFile(toZeekIntel(entries), 'blacklist-zeek.intel')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Zeek
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            Import CSV
            <input type="file" accept=".csv" ref={fileRef} onChange={handleCSV} className="hidden" />
          </label>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-sm text-white font-medium hover:bg-red-500 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
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
              placeholder={form.entry_type === 'CIDR' ? '192.168.1.0/24' : form.entry_type === 'DOMAIN' ? 'malware.example.com' : '1.2.3.4'}
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
              className="px-4 py-2 rounded-lg bg-red-600 text-sm text-white font-medium hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Block'}
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
                {['Type', 'Value', 'Reason', 'Added By', 'Blocks', 'Date', ''].map((h) => (
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
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">No entries in blacklist</td>
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
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        entry.added_by === 'threatfox' ? 'bg-red-500/15 text-red-400' :
                        entry.added_by === 'bulk_import' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-white/[0.06] text-slate-300'
                      }`}>{entry.added_by}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-400 font-mono">{entry.block_count}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove from blacklist"
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

      {/* CSV format hint */}
      <p className="text-xs text-slate-600">
        CSV format: <code className="text-slate-400">value,type,reason</code> — e.g. <code className="text-slate-400">1.2.3.4,IP,Known C2 server</code>
      </p>
    </div>
  );
}
