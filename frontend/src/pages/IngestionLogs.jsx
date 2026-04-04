import { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Info,
  ChevronLeft, ChevronRight, Search, ShieldBan, ShieldCheck, ShieldQuestion,
  ShieldAlert, BrainCircuit, Clock, MapPin, FileUp, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ingestionService } from '../services/ingestionService';

const IDS_SOURCES = [
  { id: 'suricata', name: 'Suricata', color: 'orange', formats: 'EVE JSON (.json)', description: 'One JSON object per line with event_type "alert"' },
  { id: 'zeek', name: 'Zeek', color: 'cyan', formats: 'notice.log (TSV)', description: 'Tab-separated with #fields header row' },
  { id: 'snort', name: 'Snort', color: 'red', formats: 'JSON alerts (.json)', description: 'One JSON object per line with src, dst, msg fields' },
  { id: 'kismet', name: 'Kismet', color: 'purple', formats: 'JSON alert export (.json)', description: 'JSON array or one JSON object per line with kismet.alert fields' },
];

const colorMap = {
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/30', hoverBorder: 'hover:border-orange-500/40' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', ring: 'ring-cyan-500/30', hoverBorder: 'hover:border-cyan-500/40' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30', hoverBorder: 'hover:border-red-500/40' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', ring: 'ring-purple-500/30', hoverBorder: 'hover:border-purple-500/40' },
};

const severityColors = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const selectClass =
  'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

function LogDetailModal({ log, onClose }) {
  const intel = log.threat_intel;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f1320] border border-white/[0.08] rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2 py-1 rounded border ${severityColors[log.severity]}`}>{log.severity}</span>
            <h3 className="text-lg font-semibold text-white">{log.category}</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            ['Source IP', log.source_ip], ['Destination IP', log.destination_ip],
            ['Source Port', log.source_port ?? '—'], ['Destination Port', log.destination_port ?? '—'],
            ['Protocol', log.protocol || '—'], ['IDS Source', log.ids_source],
            ['Threat Score', log.threat_score?.toFixed(2)], ['Quarantine', log.quarantine_status || 'NONE'],
          ].map(([label, value]) => (
            <div key={label} className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-sm text-white font-medium font-mono">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {log.is_whitelisted && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><ShieldCheck className="w-3 h-3" /> TRUSTED</span>
          )}
          {log.is_blocked && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-red-500/15 text-red-400 border-red-500/30"><ShieldBan className="w-3 h-3" /> BLOCKED</span>
          )}
          {log.quarantine_status === 'QUARANTINED' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-yellow-500/15 text-yellow-400 border-yellow-500/30"><ShieldQuestion className="w-3 h-3" /> QUARANTINED</span>
          )}
          {log.flagged_by_threatfox === 'true' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-orange-500/15 text-orange-400 border-orange-500/30"><ShieldAlert className="w-3 h-3" /> THREATFOX FLAGGED</span>
          )}
        </div>

        {log.ml_confidence != null && (
          <div className="bg-white/[0.03] rounded-lg p-4 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit className="w-4 h-4 text-purple-400" />
              <p className="text-sm font-medium text-white">ML Prediction</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${log.ml_confidence > 0.7 ? 'bg-red-500' : log.ml_confidence >= 0.3 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${log.ml_confidence * 100}%` }} />
              </div>
              <span className={`text-sm font-semibold ${log.ml_confidence > 0.7 ? 'text-red-400' : log.ml_confidence >= 0.3 ? 'text-yellow-400' : 'text-emerald-400'}`}>{Math.round(log.ml_confidence * 100)}%</span>
            </div>
          </div>
        )}

        {log.geo_country && (
          <div className="bg-white/[0.03] rounded-lg p-4 mb-5">
            <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4 text-blue-400" /><p className="text-sm font-medium text-white">GeoIP Location</p></div>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-xs text-slate-500">Country</p><p className="text-sm text-white">{log.geo_country}</p></div>
              <div><p className="text-xs text-slate-500">Latitude</p><p className="text-sm text-white font-mono">{log.geo_latitude?.toFixed(4) ?? '—'}</p></div>
              <div><p className="text-xs text-slate-500">Longitude</p><p className="text-sm text-white font-mono">{log.geo_longitude?.toFixed(4) ?? '—'}</p></div>
            </div>
          </div>
        )}

        {intel && (
          <div className="bg-white/[0.03] rounded-lg p-4 mb-5">
            <div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-4 h-4 text-red-400" /><p className="text-sm font-medium text-white">ThreatFox Intelligence</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-slate-500 mb-1">Malware Family</p><p className="text-sm text-white">{intel.malware || 'Unknown'}</p></div>
              <div><p className="text-xs text-slate-500 mb-1">Threat Type</p><p className="text-sm text-white">{intel.threat_type || 'Unknown'}</p></div>
            </div>
          </div>
        )}

        <div className="bg-white/[0.03] rounded-lg p-4 mb-5">
          <div className="flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-slate-400" /><p className="text-sm font-medium text-white">Timeline</p></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Detected</span><span className="text-slate-300 font-mono">{new Date(log.detected_at).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Uploaded</span><span className="text-slate-300 font-mono">{new Date(log.created_at).toLocaleString()}</span></div>
            {log.quarantined_at && <div className="flex justify-between"><span className="text-slate-500">Quarantined</span><span className="text-slate-300 font-mono">{new Date(log.quarantined_at).toLocaleString()}</span></div>}
          </div>
        </div>

        {log.raw_data && Object.keys(log.raw_data).length > 0 && (
          <details className="bg-white/[0.03] rounded-lg overflow-hidden">
            <summary className="px-4 py-3 text-sm font-medium text-white cursor-pointer hover:bg-white/[0.02] transition-colors">Raw IDS Data</summary>
            <pre className="px-4 pb-4 text-xs text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.raw_data, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default function IngestionLogs() {
  // Upload state
  const [selectedIDS, setSelectedIDS] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef();

  // Logs state
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [batches, setBatches] = useState([]);

  const selectedSource = IDS_SOURCES.find((s) => s.id === selectedIDS);
  const c = selectedSource ? colorMap[selectedSource.color] : null;

  // Fetch batches
  useEffect(() => {
    ingestionService.getBatches().then(setBatches).catch(() => {});
  }, [uploadResult]);

  // Fetch logs
  useEffect(() => { setPage(1); }, [severityFilter, categoryFilter, statusFilter, batchFilter]);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        const data = await ingestionService.getLogs({
          severity: severityFilter,
          category: categoryFilter,
          quarantineStatus: statusFilter,
          batchId: batchFilter || undefined,
          page,
          pageSize,
        });
        if (!cancelled) { setLogs(data.logs); setTotal(data.total); }
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [severityFilter, categoryFilter, statusFilter, batchFilter, page, pageSize, uploadResult]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filteredLogs = search
    ? logs.filter((l) => l.source_ip.includes(search) || l.destination_ip.includes(search) || l.category.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 10 * 1024 * 1024) { setUploadError('File too large. Maximum size is 10MB.'); return; }
      setFile(f); setUploadError(''); setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedIDS) return;
    setUploading(true); setUploadError(''); setUploadResult(null);
    try {
      const data = await ingestionService.uploadFile(file, selectedIDS);
      setUploadResult(data);
      toast.success(`Processed ${data.ingested} log entries`, { style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(16,185,129,0.3)' } });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Upload failed. Check your file format.');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null); setSelectedIDS(null); setUploadResult(null); setUploadError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleBlock = async (log) => {
    try {
      const updated = await ingestionService.blockLog(log.id);
      setLogs((prev) => prev.map((l) => l.id === log.id ? updated : l));
      toast.success(`Blocked ${log.source_ip}`, { style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' } });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to block', { style: { background: '#1e1e2e', color: '#fff' } });
    }
  };

  const handleTrust = async (log) => {
    try {
      const updated = await ingestionService.trustLog(log.id);
      setLogs((prev) => prev.map((l) => l.id === log.id ? updated : l));
      toast.success(`Trusted ${log.source_ip}`, { style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(16,185,129,0.3)' } });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to trust', { style: { background: '#1e1e2e', color: '#fff' } });
    }
  };

  const handleRelease = async (log) => {
    try {
      const updated = await ingestionService.releaseLog(log.id);
      setLogs((prev) => prev.map((l) => l.id === log.id ? updated : l));
      toast.success('Released from quarantine', { style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(234,179,8,0.3)' } });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to release', { style: { background: '#1e1e2e', color: '#fff' } });
    }
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const pageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    if (start > 1) pages.push(1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    if (end < totalPages) pages.push(totalPages);
    return pages;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileUp className="w-6 h-6 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Ingestion Logs</h1>
      </div>

      <p className="text-sm text-slate-400">
        Upload log files from your IDS engines. Files are processed through the full pipeline — threat scoring, ML detection, blacklist/whitelist checks, and auto-quarantine.
      </p>

      {/* Upload Section */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-slate-300">1. Select IDS Source</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {IDS_SOURCES.map((ids) => {
            const colors = colorMap[ids.color];
            const active = selectedIDS === ids.id;
            return (
              <button
                key={ids.id}
                onClick={() => { setSelectedIDS(ids.id); setUploadError(''); setUploadResult(null); }}
                className={`relative text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  active ? `${colors.bg} ${colors.border} ring-1 ${colors.ring}` : `bg-white/[0.03] border-white/[0.06] ${colors.hoverBorder} hover:bg-white/[0.05]`
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${active ? colors.text : 'text-white'}`}>{ids.name}</span>
                  {active && <CheckCircle className={`w-4 h-4 ${colors.text}`} />}
                </div>
                <p className="text-xs text-slate-500 mt-1">{ids.formats}</p>
              </button>
            );
          })}
        </div>

        {selectedIDS && (
          <>
            <h2 className="text-sm font-medium text-slate-300">2. Upload Log File</h2>
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${file ? `${c.border} ${c.bg}` : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02]'}`}>
              {file ? (
                <div className="space-y-3">
                  <FileText className={`w-10 h-10 mx-auto ${c.text}`} />
                  <div>
                    <p className="text-sm font-medium text-white">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB — {selectedSource.name} format</p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={handleUpload} disabled={uploading} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? 'Processing...' : 'Process File'}
                    </button>
                    <button onClick={handleClear} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/[0.08] text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer">
                      <X className="w-4 h-4" /> Clear
                    </button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer space-y-3 block">
                  <Upload className="w-10 h-10 mx-auto text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-300">Drop your <span className={c.text}>{selectedSource.name}</span> log file here or click to browse</p>
                    <p className="text-xs text-slate-500 mt-1">{selectedSource.description} — max 10MB</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".json,.log,.txt,.tsv,.csv" onChange={handleFileSelect} className="hidden" />
                </label>
              )}
            </div>
          </>
        )}

        {uploadError && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" /><p className="text-sm text-red-400">{uploadError}</p>
          </div>
        )}
        {uploadResult && (
          <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-green-400 font-medium">{uploadResult.message}</p>
              <p className="text-xs text-green-400/70 mt-1">{uploadResult.parsed} entries parsed, {uploadResult.ingested} processed from {uploadResult.filename}</p>
            </div>
          </div>
        )}
      </div>

      {/* Processed Logs Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Processed Logs</h2>
          <span className="text-sm text-slate-500">({total} total)</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className={selectClass}>
            <option value="All">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
            <option value="All">All Categories</option>
            <option value="SQL_INJECTION">SQL Injection</option>
            <option value="DDOS">DDoS</option>
            <option value="MALWARE">Malware</option>
            <option value="BRUTE_FORCE">Brute Force</option>
            <option value="XSS">XSS</option>
            <option value="PORT_SCAN">Port Scan</option>
            <option value="COMMAND_INJECTION">Command Injection</option>
            <option value="PRIVILEGE_ESCALATION">Privilege Escalation</option>
            <option value="DATA_EXFILTRATION">Data Exfiltration</option>
            <option value="ANOMALY">Anomaly</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="All">All Statuses</option>
            <option value="QUARANTINED">Quarantined</option>
            <option value="RELEASED">Released</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          {batches.length > 0 && (
            <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className={selectClass}>
              <option value="">All Uploads</option>
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>{b.filename} ({b.count})</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input type="text" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-full" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Time', 'File', 'Severity', 'Category', 'Source IP', 'Dest IP', 'Score', 'ML', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="px-5 py-12 text-center"><Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" /><span className="text-sm text-slate-500">Loading logs...</span></td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-500">No ingestion logs found</td></tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-sm text-slate-400 font-mono">{formatTime(log.detected_at)}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 truncate max-w-[120px]" title={log.upload_filename}>{log.upload_filename}</td>
                      <td className="px-5 py-3"><span className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${severityColors[log.severity]}`}>{log.severity}</span></td>
                      <td className="px-5 py-3 text-sm text-slate-300 font-mono">{log.category}</td>
                      <td className="px-5 py-3 text-sm text-slate-400 font-mono">{log.source_ip}</td>
                      <td className="px-5 py-3 text-sm text-slate-400 font-mono">{log.destination_ip}</td>
                      <td className="px-5 py-3 text-sm text-slate-400 font-mono">{log.threat_score}</td>
                      <td className="px-5 py-3">
                        {log.ml_confidence != null ? (
                          <span className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${
                            log.ml_confidence > 0.7 ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : log.ml_confidence >= 0.3 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}>ML: {Math.round(log.ml_confidence * 100)}%</span>
                        ) : <span className="text-xs text-slate-600">N/A</span>}
                      </td>
                      <td className="px-5 py-3">
                        {log.is_whitelisted ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><ShieldCheck className="w-3 h-3" /> TRUSTED</span>
                        ) : log.is_blocked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-red-500/15 text-red-400 border-red-500/30"><ShieldBan className="w-3 h-3" /> BLOCKED</span>
                        ) : log.quarantine_status === 'QUARANTINED' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-yellow-500/15 text-yellow-400 border-yellow-500/30"><ShieldQuestion className="w-3 h-3" /> QUARANTINED</span>
                        ) : log.flagged_by_threatfox === 'true' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border bg-orange-500/15 text-orange-400 border-orange-500/30"><ShieldAlert className="w-3 h-3" /> FLAGGED</span>
                        ) : <span className="text-xs text-slate-600">Clean</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedLog(log)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">Details</button>
                          {!log.is_blocked && !log.is_whitelisted && (
                            <>
                              <span className="text-slate-700">|</span>
                              <button onClick={() => handleBlock(log)} className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer">Block</button>
                              <span className="text-slate-700">|</span>
                              <button onClick={() => handleTrust(log)} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer">Trust</button>
                            </>
                          )}
                          {log.quarantine_status === 'QUARANTINED' && !log.is_blocked && !log.is_whitelisted && (
                            <>
                              <span className="text-slate-700">|</span>
                              <button onClick={() => handleRelease(log)} className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors cursor-pointer">Release</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
            <span className="text-sm text-slate-500">
              Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} logs
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNumbers().map((p, i) =>
                p === '...' ? <span key={`dots-${i}`} className="text-slate-600 px-1">...</span> : (
                  <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${p === page ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}>{p}</button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
