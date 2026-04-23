import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Activity, Users, ShieldAlert } from 'lucide-react';
import { alertService } from '../services/alertService';
import { useAuth } from '../context/AuthContext';

const WINDOWS = [
  { label: '5 min', value: '5m' },
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
];

const MIN_ENGINES = [
  { label: '≥ 2 engines', value: 2 },
  { label: '≥ 3 engines', value: 3 },
  { label: 'All 4', value: 4 },
];

const ALL_ENGINES = ['suricata', 'zeek', 'snort', 'kismet'];

const ENGINE_META = {
  suricata: { label: 'Suricata', accent: 'orange', dot: '#F97316' },
  zeek:     { label: 'Zeek',     accent: 'cyan',   dot: '#06B6D4' },
  snort:    { label: 'Snort',    accent: 'red',    dot: '#EF4444' },
  kismet:   { label: 'Kismet',   accent: 'purple', dot: '#A855F7' },
};

const ACCENT_CLASSES = {
  orange: 'border-orange-500/30 bg-orange-500/5',
  cyan:   'border-cyan-500/30 bg-cyan-500/5',
  red:    'border-red-500/30 bg-red-500/5',
  purple: 'border-purple-500/30 bg-purple-500/5',
};

const SEVERITY_COLOURS = {
  CRITICAL: 'text-red-400',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-yellow-400',
  LOW:      'text-slate-400',
};

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function EngineCard({ engine }) {
  const meta = ENGINE_META[engine.ids_source] || { label: engine.ids_source, accent: 'blue', dot: '#3B82F6' };
  const accentClass = ACCENT_CLASSES[meta.accent] || 'border-white/10 bg-white/[0.03]';
  const severities = engine.severity || { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const total = engine.alert_count || 0;

  return (
    <div className={`rounded-xl border p-5 transition-all ${accentClass}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
        <h3 className="text-base font-semibold text-white">{meta.label}</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Alerts</div>
          <div className="text-xl font-bold text-white mt-0.5">{total.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Unique IPs</div>
          <div className="text-xl font-bold text-white mt-0.5">{(engine.unique_ips || 0).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Avg Score</div>
          <div className="text-xl font-bold text-white mt-0.5">{(engine.avg_score || 0).toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/[0.06]">
        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
          <div key={sev} className="text-center">
            <div className={`text-sm font-semibold ${SEVERITY_COLOURS[sev]}`}>{severities[sev] || 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{sev.slice(0, 3)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnginePill({ engine, active }) {
  const meta = ENGINE_META[engine] || { label: engine, dot: '#64748b' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
        active
          ? 'text-white border-white/20 bg-white/[0.08]'
          : 'text-slate-600 border-white/[0.04] bg-transparent'
      }`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: active ? meta.dot : '#334155' }}
      />
      {meta.label}
    </span>
  );
}

function ConsensusTable({ data, loading, activeEngines }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-slate-500">
        No source IPs matched by multiple engines in this window.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/[0.06]">
            <th className="py-2.5 px-3 font-medium">Source IP</th>
            <th className="py-2.5 px-3 font-medium">Engines Agreeing</th>
            <th className="py-2.5 px-3 font-medium text-right">Alerts</th>
            <th className="py-2.5 px-3 font-medium">Max Severity</th>
            <th className="py-2.5 px-3 font-medium">First Seen</th>
            <th className="py-2.5 px-3 font-medium">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.source_ip} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
              <td className="py-2.5 px-3">
                <code className="text-slate-200 text-xs">{row.source_ip}</code>
              </td>
              <td className="py-2.5 px-3">
                <div className="flex flex-wrap gap-1">
                  {activeEngines.map((e) => (
                    <EnginePill key={e} engine={e} active={row.engines.includes(e)} />
                  ))}
                </div>
              </td>
              <td className="py-2.5 px-3 text-right text-slate-300">{row.alert_count}</td>
              <td className="py-2.5 px-3">
                <span className={`text-xs font-semibold ${SEVERITY_COLOURS[row.max_severity] || 'text-slate-400'}`}>
                  {row.max_severity || '—'}
                </span>
              </td>
              <td className="py-2.5 px-3 text-slate-400 text-xs">{formatTime(row.first_seen)}</td>
              <td className="py-2.5 px-3 text-slate-400 text-xs">{formatTime(row.last_seen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverlapMatrix({ data, loading, activeEngines }) {
  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  const engines = (data.engines || []).filter((e) => activeEngines.includes(e));
  const matrix = data.matrix || {};

  let maxOff = 0;
  engines.forEach((a) => engines.forEach((b) => {
    if (a !== b) maxOff = Math.max(maxOff, matrix[a]?.[b] ?? 0);
  }));

  const cellBg = (a, b, val) => {
    if (a === b) return 'rgba(255,255,255,0.04)';
    if (!maxOff || !val) return 'rgba(255,255,255,0.02)';
    const t = Math.min(1, val / maxOff);
    // Blue intensity scales with overlap.
    return `rgba(59, 130, 246, ${0.08 + t * 0.5})`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="p-2" />
            {engines.map((e) => (
              <th key={e} className="p-2 text-[11px] uppercase tracking-wider text-slate-400 font-medium text-center">
                {ENGINE_META[e]?.label || e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {engines.map((a) => (
            <tr key={a}>
              <th className="p-2 text-[11px] uppercase tracking-wider text-slate-400 font-medium text-right">
                {ENGINE_META[a]?.label || a}
              </th>
              {engines.map((b) => {
                const val = matrix[a]?.[b] ?? 0;
                const isDiag = a === b;
                return (
                  <td
                    key={b}
                    className="p-2 text-center rounded"
                    style={{ background: cellBg(a, b, val), minWidth: 72 }}
                    title={isDiag
                      ? `${ENGINE_META[a]?.label || a}: ${val} unique source IPs`
                      : `${val} IPs shared between ${ENGINE_META[a]?.label || a} & ${ENGINE_META[b]?.label || b}`}
                  >
                    <div className={`font-semibold ${isDiag ? 'text-slate-300' : 'text-white'}`}>{val}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-3">
        Diagonal = total unique source IPs flagged by that engine. Off-diagonal = IPs both engines flagged.
      </p>
    </div>
  );
}

function UniqueCoverage({ data, loading, activeEngines }) {
  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  const engines = (data.engines || []).filter((e) => activeEngines.includes(e.ids_source));
  if (engines.every((e) => !e.alert_count)) {
    return (
      <div className="text-center py-6 text-sm text-slate-500">
        No single-engine detections in this window.
      </div>
    );
  }

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
    >
      {engines.map((e) => {
        const meta = ENGINE_META[e.ids_source] || { label: e.ids_source, dot: '#3B82F6' };
        return (
          <div key={e.ids_source} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
              <span className="text-sm font-medium text-white">{meta.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{e.unique_ips}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {e.unique_ips === 1 ? 'IP no other engine saw' : 'IPs no other engine saw'}
            </div>
            <div className="text-[11px] text-slate-600 mt-1">{e.alert_count} total alert{e.alert_count === 1 ? '' : 's'}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function EngineComparison() {
  const { user } = useAuth();
  if (user?.tier?.toUpperCase() === 'FREE') return <Navigate to="/dashboard" replace />;

  const [window, setWindow] = useState('1h');
  const [minEngines, setMinEngines] = useState(2);

  const [stats, setStats] = useState(null);
  const [consensus, setConsensus] = useState(null);
  const [overlap, setOverlap] = useState(null);
  const [unique, setUnique] = useState(null);
  const [observedEngines, setObservedEngines] = useState(null); // null = still loading

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingConsensus, setLoadingConsensus] = useState(true);
  const [loadingOverlap, setLoadingOverlap] = useState(true);
  const [loadingUnique, setLoadingUnique] = useState(true);
  const [error, setError] = useState('');

  // Engines actually ingesting data (over the last 30 days). Falls back to all
  // four if we haven't observed any yet, so new users still see the full layout.
  useEffect(() => {
    let cancelled = false;
    alertService.getEnginesInUse(30)
      .then((d) => { if (!cancelled) setObservedEngines(d.engines || []); })
      .catch(() => { if (!cancelled) setObservedEngines([]); });
    return () => { cancelled = true; };
  }, []);

  const activeEngines = (observedEngines && observedEngines.length > 0)
    ? observedEngines
    : ALL_ENGINES;
  const isFallback = !observedEngines || observedEngines.length === 0;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      setLoadingStats(true);
      setLoadingOverlap(true);
      setLoadingUnique(true);
      try {
        const [s, o, u] = await Promise.all([
          alertService.getEngineStats(window),
          alertService.getEngineOverlap(window),
          alertService.getEngineUnique(window),
        ]);
        if (cancelled) return;
        setStats(s);
        setOverlap(o);
        setUnique(u);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.detail || 'Failed to load engine stats.');
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
          setLoadingOverlap(false);
          setLoadingUnique(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [window]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingConsensus(true);
      try {
        const d = await alertService.getEngineConsensus({ window, minEngines });
        if (!cancelled) setConsensus(d);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load consensus.');
      } finally {
        if (!cancelled) setLoadingConsensus(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [window, minEngines]);

  const engineCards = (stats?.engines || []).filter((e) => activeEngines.includes(e.ids_source));

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-blue-400" />
            Engine Comparison
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Compare what your IDS engines are detecting — and where they agree.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Ingesting:</span>
            {isFallback ? (
              <span className="text-xs text-slate-500 italic">
                No alerts observed in the last 30 days — showing all supported engines.
              </span>
            ) : (
              <>
                {activeEngines.map((e) => (
                  <EnginePill key={e} engine={e} active />
                ))}
                <span className="text-[11px] text-slate-600">({activeEngines.length} of {ALL_ENGINES.length})</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider mr-1">Window</span>
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setWindow(w.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-all cursor-pointer ${
                window === w.value
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/[0.12]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Engine cards */}
      <section className="mb-6">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          {loadingStats
            ? activeEngines.map((e) => (
                <div key={e} className="h-40 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
              ))
            : engineCards.map((e) => <EngineCard key={e.ids_source} engine={e} />)}
        </div>
      </section>

      {/* Consensus table */}
      <section className="mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Cross-Engine Consensus
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Source IPs that multiple engines flagged in the same window — high-precision signals.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {MIN_ENGINES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMinEngines(m.value)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-md border transition-all cursor-pointer ${
                  minEngines === m.value
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                    : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/[0.12]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <ConsensusTable data={consensus?.results} loading={loadingConsensus} activeEngines={activeEngines} />
      </section>

      {/* Overlap matrix + Unique coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-1">Pairwise Overlap</h2>
          <p className="text-xs text-slate-500 mb-4">
            How often do the engines flag the same source IPs?
          </p>
          <OverlapMatrix data={overlap} loading={loadingOverlap} activeEngines={activeEngines} />
        </section>

        <section className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            Single-Engine Detections
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Source IPs only one engine caught — unique coverage, but also likely false-positive source.
          </p>
          <UniqueCoverage data={unique} loading={loadingUnique} activeEngines={activeEngines} />
        </section>
      </div>
    </div>
  );
}
