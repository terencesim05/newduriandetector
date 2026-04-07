import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { comparisonService } from '../services/comparisonService'
import { GitCompare, Play, AlertTriangle, Loader2, History, Trash2 } from 'lucide-react'

const SEVERITY_COLORS = {
  low: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  medium: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
}

function SeverityBadge({ severity }) {
  if (!severity) return <span className="text-slate-600 text-xs">—</span>
  const cls = SEVERITY_COLORS[severity.toLowerCase()] || SEVERITY_COLORS.low
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${cls}`}>
      {severity}
    </span>
  )
}

function AgreementBadge({ agreement }) {
  const map = {
    both: { label: 'Both', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    snort_only: { label: 'Snort only', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    suricata_only: { label: 'Suricata only', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  }
  const { label, cls } = map[agreement] || map.both
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${cls}`}>
      {label}
    </span>
  )
}

export default function EngineComparison() {
  const { user } = useAuth()
  const isExclusive = (user?.tier || '').toUpperCase() === 'EXCLUSIVE'

  const [samples, setSamples] = useState([])
  const [history, setHistory] = useState([])
  const [run, setRun] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [showOnlyDisagreements, setShowOnlyDisagreements] = useState(false)

  useEffect(() => {
    if (!isExclusive) return
    let cancelled = false
    Promise.all([comparisonService.listSamples(), comparisonService.listRuns()])
      .then(([s, h]) => {
        if (cancelled) return
        setSamples(s)
        setHistory(h)
      })
      .catch((e) => setError(e.response?.data?.detail || 'Failed to load'))
    return () => {
      cancelled = true
    }
  }, [isExclusive])

  const handleRun = async (sampleName) => {
    setRunning(true)
    setError('')
    try {
      const result = await comparisonService.runComparison(sampleName)
      setRun(result)
      const updated = await comparisonService.listRuns()
      setHistory(updated)
    } catch (e) {
      setError(e.response?.data?.detail || 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  const handleOpenHistory = async (id) => {
    setError('')
    try {
      const r = await comparisonService.getRun(id)
      setRun(r)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load run')
    }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    try {
      await comparisonService.deleteRun(id)
      setHistory((h) => h.filter((r) => r.id !== id))
      if (run?.id === id) setRun(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed')
    }
  }

  if (!isExclusive) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center">
          <GitCompare className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-white mb-2">IDS Engine Comparison</h1>
          <p className="text-slate-400 mb-6">
            This feature is exclusive to the Exclusive tier. Upgrade to replay the same traffic
            through Snort and Suricata side-by-side and surface the disagreements between engines.
          </p>
          <a
            href="/settings"
            className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-medium px-5 py-2.5 rounded-lg transition-all"
          >
            Upgrade to Exclusive
          </a>
        </div>
      </div>
    )
  }

  const filteredPairs = run
    ? showOnlyDisagreements
      ? run.matched_pairs.filter(
          (p) => p.agreement !== 'both' || p.severity_disagrees
        )
      : run.matched_pairs
    : []

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-purple-400" />
          IDS Engine Comparison
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Replay the same traffic through Snort and Suricata, then surface where they
          disagree. The interesting result isn't where the engines agree — it's where they don't.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Sample picker */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Pick a scenario
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {samples.map((s) => (
            <div
              key={s.name}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 flex flex-col"
            >
              <h3 className="text-white font-semibold mb-2">{s.label}</h3>
              <p className="text-xs text-slate-400 leading-relaxed flex-1">{s.description}</p>
              <button
                onClick={() => handleRun(s.name)}
                disabled={running}
                className="mt-4 inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run comparison
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {run && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Results — {run.sample_label}
            </h2>

            {/* Big numbers */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Tile label="Snort alerts" value={run.snort_count} color="text-blue-300" />
              <Tile label="Suricata alerts" value={run.suricata_count} color="text-purple-300" />
              <Tile label="Both caught" value={run.agreement_count} color="text-emerald-300" />
              <Tile label="Snort only" value={run.snort_only_count} color="text-blue-300" />
              <Tile label="Suricata only" value={run.suricata_only_count} color="text-purple-300" />
            </div>
          </div>

          {/* Severity disagreements highlight */}
          {run.severity_disagreement_count > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4" />
                {run.severity_disagreement_count} severity disagreement
                {run.severity_disagreement_count === 1 ? '' : 's'}
              </div>
              <p className="text-xs text-amber-200/70 mt-1">
                Both engines flagged the same event but rated it at different severities. These
                are the spiciest results — they reveal that severity is rule-author opinion, not
                ground truth.
              </p>
            </div>
          )}

          {/* Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyDisagreements}
                onChange={(e) => setShowOnlyDisagreements(e.target.checked)}
                className="rounded"
              />
              Show only disagreements
            </label>
            <span className="text-xs text-slate-500">
              ({filteredPairs.length} of {run.matched_pairs.length} shown)
            </span>
          </div>

          {/* Diff table */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Agreement</th>
                  <th className="px-4 py-3">Flow</th>
                  <th className="px-4 py-3">Snort signature</th>
                  <th className="px-4 py-3">Snort sev</th>
                  <th className="px-4 py-3">Suricata signature</th>
                  <th className="px-4 py-3">Suricata sev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredPairs.map((p, i) => {
                  const a = p.snort || p.suricata
                  return (
                    <tr
                      key={i}
                      className={p.severity_disagrees ? 'bg-amber-500/5' : ''}
                    >
                      <td className="px-4 py-3">
                        <AgreementBadge agreement={p.agreement} />
                        {p.severity_disagrees && (
                          <div className="text-[10px] text-amber-300 mt-1">⚠ sev mismatch</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs font-mono">
                        {a.src_ip} → {a.dst_ip}:{a.dst_port}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {p.snort?.signature || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={p.snort?.severity} />
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {p.suricata?.signature || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={p.suricata?.severity} />
                      </td>
                    </tr>
                  )
                })}
                {filteredPairs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                      No rows to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <History className="w-3.5 h-3.5" /> Recent runs
          </h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {history.map((h) => (
              <div
                key={h.id}
                onClick={() => handleOpenHistory(h.id)}
                className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">{h.sample_label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Snort {h.snort_count} · Suricata {h.suricata_count} · Both {h.agreement_count}
                    {h.severity_disagreement_count > 0 && (
                      <span className="text-amber-400">
                        {' '}· {h.severity_disagreement_count} sev disagreement
                        {h.severity_disagreement_count === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mr-3">
                  {new Date(h.created_at).toLocaleString()}
                </div>
                <button
                  onClick={(e) => handleDelete(h.id, e)}
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, color }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-4">
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  )
}
