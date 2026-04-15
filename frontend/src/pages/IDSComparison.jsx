import { useState, useEffect, useRef } from 'react';
import {
  GitCompareArrows, Loader2, RotateCcw, Image,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import html2canvas from 'html2canvas';
import { alertService } from '../services/alertService';

// ── Constants ──
const IDS_COLORS = {
  suricata: '#3B82F6',
  zeek: '#10B981',
  snort: '#F59E0B',
  kismet: '#EF4444',
};

const IDS_LABELS = {
  suricata: 'Suricata',
  zeek: 'Zeek',
  snort: 'Snort',
  kismet: 'Kismet',
};

const ALL_IDS = ['suricata', 'zeek', 'snort', 'kismet'];

const DATE_RANGES = [
  { label: 'Past 24 hours', value: '24h' },
  { label: 'Past 7 days', value: '7d' },
  { label: 'Past 30 days', value: '30d' },
  { label: 'Past 90 days', value: '90d' },
];

const TOOLTIP_STYLE = {
  background: '#0f1320',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#fff',
};

function getDateRange(rangeKey) {
  const now = new Date();
  const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
  const days = map[rangeKey] || 7;
  const start = new Date(now.getTime() - days * 86400000);
  return { startDate: start.toISOString(), endDate: now.toISOString(), days };
}

function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatCategory(cat) {
  return (cat || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Chart Card Wrapper ──
function ChartCard({ title, subtitle, chartRef, children }) {
  const handleExportPng = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { backgroundColor: '#0a0e1a' });
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <button onClick={handleExportPng} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" title="Save chart as image">
          <Image className="w-3.5 h-3.5" />
          Save image
        </button>
      </div>
      {subtitle && <p className="text-xs text-slate-500 mb-3">{subtitle}</p>}
      <div ref={chartRef}>{children}</div>
    </div>
  );
}

// ── Stat Card ──
function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color || '#fff' }}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── 1. IDS Volume Chart (grouped bar by severity) ──
function IDSVolumeChart({ data }) {
  if (!data || data.length === 0)
    return <div className="flex items-center justify-center h-64 text-sm text-slate-500">No data available</div>;

  const chartData = data.map(d => ({
    name: IDS_LABELS[d.ids_source] || d.ids_source,
    LOW: d.severities?.LOW || 0,
    MEDIUM: d.severities?.MEDIUM || 0,
    HIGH: d.severities?.HIGH || 0,
    CRITICAL: d.severities?.CRITICAL || 0,
    total: d.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend />
        <Bar dataKey="CRITICAL" fill="#EF4444" />
        <Bar dataKey="HIGH" fill="#F97316" />
        <Bar dataKey="MEDIUM" fill="#F59E0B" />
        <Bar dataKey="LOW" fill="#64748B" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 2. Detection Overlap Heatmap ──
function OverlapHeatmap({ pairMatrix }) {
  if (!pairMatrix) return <div className="flex items-center justify-center h-64 text-sm text-slate-500">No overlap data</div>;

  const activeIDS = ALL_IDS.filter(ids => {
    const hasData = ALL_IDS.some(other => (pairMatrix[ids]?.[other] || 0) > 0 || (pairMatrix[other]?.[ids] || 0) > 0);
    return hasData;
  });

  if (activeIDS.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-sm text-slate-500">
        <p>No detection overlaps found</p>
        <p className="text-xs mt-1">Overlaps appear when multiple IDS detect the same source/destination pair within the time window</p>
      </div>
    );
  }

  const maxVal = Math.max(1, ...activeIDS.flatMap(a => activeIDS.map(b => pairMatrix[a]?.[b] || 0)));

  const getCellColor = (val) => {
    if (val === 0) return 'rgba(255,255,255,0.02)';
    const intensity = Math.min(val / maxVal, 1);
    return `rgba(59, 130, 246, ${0.15 + intensity * 0.65})`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left text-slate-500 font-medium">IDS</th>
            {activeIDS.map(ids => (
              <th key={ids} className="p-2 text-center font-medium" style={{ color: IDS_COLORS[ids] }}>
                {IDS_LABELS[ids]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeIDS.map(rowIds => (
            <tr key={rowIds}>
              <td className="p-2 font-medium" style={{ color: IDS_COLORS[rowIds] }}>{IDS_LABELS[rowIds]}</td>
              {activeIDS.map(colIds => {
                const val = rowIds === colIds ? '-' : (pairMatrix[rowIds]?.[colIds] || 0);
                return (
                  <td
                    key={colIds}
                    className="p-2 text-center rounded"
                    style={{
                      backgroundColor: rowIds === colIds ? 'rgba(255,255,255,0.03)' : getCellColor(val),
                      color: val === '-' ? '#475569' : val > 0 ? '#fff' : '#64748b',
                      fontWeight: val > 0 ? 600 : 400,
                    }}
                  >
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 3. Unique Detection Donut ──
function UniqueDetectionDonut({ overlapData }) {
  if (!overlapData) return <div className="flex items-center justify-center h-64 text-sm text-slate-500">No data</div>;

  const { unique_detections, overlap_count } = overlapData;
  const chartData = [
    ...ALL_IDS
      .filter(ids => (unique_detections?.[ids] || 0) > 0)
      .map(ids => ({
        name: `${IDS_LABELS[ids]} Only`,
        value: unique_detections[ids],
        color: IDS_COLORS[ids],
      })),
  ];
  if (overlap_count > 0) {
    chartData.push({ name: 'Multi-IDS Overlap', value: overlap_count, color: '#8B5CF6' });
  }

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-64 text-sm text-slate-500">No detection data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 4. Category Radar ──
function CategoryRadar({ data }) {
  if (!data || data.length === 0)
    return <div className="flex items-center justify-center h-64 text-sm text-slate-500">No data available</div>;

  const radarData = data.map(d => ({
    category: formatCategory(d.category),
    ...ALL_IDS.reduce((acc, ids) => ({ ...acc, [ids]: d[ids] || 0 }), {}),
  }));

  // Only show IDS that have data
  const activeIDS = ALL_IDS.filter(ids => radarData.some(d => d[ids] > 0));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 9 }} />
        {activeIDS.map(ids => (
          <Radar
            key={ids}
            name={IDS_LABELS[ids]}
            dataKey={ids}
            stroke={IDS_COLORS[ids]}
            fill={IDS_COLORS[ids]}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
        <Legend />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── 5. IDS Timeline ──
function IDSTimeline({ data }) {
  if (!data || data.length === 0)
    return <div className="flex items-center justify-center h-64 text-sm text-slate-500">No data available</div>;

  const chartData = data.map(d => ({
    name: formatTime(d.time),
    ...ALL_IDS.reduce((acc, ids) => ({ ...acc, [ids]: d[ids] || 0 }), {}),
  }));

  const activeIDS = ALL_IDS.filter(ids => chartData.some(d => d[ids] > 0));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend />
        {activeIDS.map(ids => (
          <Line
            key={ids}
            type="monotone"
            dataKey={ids}
            name={IDS_LABELS[ids]}
            stroke={IDS_COLORS[ids]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Accuracy Table ──
function AccuracyTable({ data }) {
  if (!data || data.length === 0)
    return <div className="text-sm text-slate-500">No accuracy data available</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">IDS Source</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Alerts</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">High/Critical %</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Threat Score</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg ML Confidence</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Blocked</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Quarantined</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Whitelist Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.ids_source} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <td className="py-3 px-4 font-medium" style={{ color: IDS_COLORS[row.ids_source] }}>
                {IDS_LABELS[row.ids_source] || row.ids_source}
              </td>
              <td className="py-3 px-4 text-center text-white font-semibold">{row.total}</td>
              <td className="py-3 px-4 text-center">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  row.high_critical_ratio > 0.5 ? 'bg-red-500/15 text-red-400' :
                  row.high_critical_ratio > 0.25 ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-green-500/15 text-green-400'
                }`}>
                  {(row.high_critical_ratio * 100).toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-4 text-center text-slate-300">{row.avg_threat_score.toFixed(3)}</td>
              <td className="py-3 px-4 text-center text-slate-300">{row.avg_ml_confidence.toFixed(3)}</td>
              <td className="py-3 px-4 text-center text-slate-300">{row.blocked_count}</td>
              <td className="py-3 px-4 text-center text-slate-300">{row.quarantined_count}</td>
              <td className="py-3 px-4 text-center text-slate-300">{(row.whitelist_ratio * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ──
export default function IDSComparison() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('7d');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Data
  const [summary, setSummary] = useState([]);
  const [overlap, setOverlap] = useState(null);
  const [accuracy, setAccuracy] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [categoryByIds, setCategoryByIds] = useState([]);

  // Refs
  const volumeRef = useRef(null);
  const overlapRef = useRef(null);
  const donutRef = useRef(null);
  const radarRef = useRef(null);
  const timelineRef = useRef(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate, days } = getDateRange(range);
      const params = {
        startDate,
        endDate,
        severity: severityFilter || undefined,
        category: categoryFilter || undefined,
      };

      const [sum, ovl, acc, tl, cat] = await Promise.all([
        alertService.getIDSSummary(params),
        alertService.getDetectionOverlap(params),
        alertService.getAccuracyMatrix(params),
        alertService.getIDSTimeline({ ...params, days }),
        alertService.getCategoryByIDS(params),
      ]);

      setSummary(sum);
      setOverlap(ovl);
      setAccuracy(acc);
      setTimeline(tl);
      setCategoryByIds(cat);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load IDS comparison data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Compute stats
  const totalAlerts = summary.reduce((s, d) => s + d.total, 0);
  const activeIdsCount = summary.length;
  const overlapPct = overlap && overlap.total_events > 0
    ? ((overlap.overlap_count / overlap.total_events) * 100).toFixed(1)
    : '0.0';

  const selectClass = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <GitCompareArrows className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">IDS Comparison</h1>
            <p className="text-sm text-slate-500">Compare detection accuracy across Suricata, Zeek, Snort & Kismet</p>
          </div>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer">
          <RotateCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4">
        <p className="text-xs text-slate-400 mb-3">Filter comparison data — select time range, severity, or attack type.</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Time range</span>
            <select value={range} onChange={e => setRange(e.target.value)} className={selectClass}>
              {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Risk level</span>
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className={selectClass}>
              <option value="">All levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Attack type</span>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={selectClass}>
              <option value="">All types</option>
              {['SQL_INJECTION', 'DDOS', 'MALWARE', 'BRUTE_FORCE', 'XSS', 'PORT_SCAN', 'COMMAND_INJECTION', 'PRIVILEGE_ESCALATION', 'DATA_EXFILTRATION', 'ANOMALY'].map(c => (
                <option key={c} value={c}>{formatCategory(c)}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchAll} className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer">
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Alerts" value={totalAlerts.toLocaleString()} color="#3B82F6" />
            <StatCard label="Active IDS Engines" value={activeIdsCount} sub={`of ${ALL_IDS.length} supported`} color="#10B981" />
            <StatCard label="Detection Overlap" value={`${overlapPct}%`} sub="events seen by 2+ IDS" color="#8B5CF6" />
            <StatCard label="Unique Events" value={overlap?.total_events?.toLocaleString() || '0'} sub="distinct src/dst pairs" color="#F59E0B" />
          </div>

          {/* Charts grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 1. Volume by IDS */}
            <ChartCard title="Alert Volume by IDS" subtitle="Total alerts detected by each IDS engine, broken down by severity" chartRef={volumeRef}>
              <IDSVolumeChart data={summary} />
            </ChartCard>

            {/* 2. Detection Overlap Heatmap */}
            <ChartCard title="Detection Overlap Matrix" subtitle="How many events were detected by both IDS engines (row & column)" chartRef={overlapRef}>
              <OverlapHeatmap pairMatrix={overlap?.pair_matrix} />
            </ChartCard>

            {/* 3. Unique Detection Donut */}
            <ChartCard title="Unique vs Shared Detections" subtitle="What percentage of events are exclusive to one IDS vs detected by multiple" chartRef={donutRef}>
              <UniqueDetectionDonut overlapData={overlap} />
            </ChartCard>

            {/* 4. Category Radar */}
            <ChartCard title="Category Coverage Radar" subtitle="Which attack categories each IDS detects — wider coverage means broader detection" chartRef={radarRef}>
              <CategoryRadar data={categoryByIds} />
            </ChartCard>

            {/* 5. Timeline */}
            <div className="lg:col-span-2">
              <ChartCard title="Detection Timeline" subtitle="Alerts over time by IDS source — reveals temporal detection differences" chartRef={timelineRef}>
                <IDSTimeline data={timeline} />
              </ChartCard>
            </div>
          </div>

          {/* Accuracy comparison table */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm font-medium text-white mb-1">Accuracy & Quality Metrics</h3>
            <p className="text-xs text-slate-500 mb-4">Detailed comparison of detection quality across IDS platforms</p>
            <AccuracyTable data={accuracy} />
          </div>

          {/* Top overlapping events */}
          {overlap?.overlaps?.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-medium text-white mb-1">Top Overlapping Events</h3>
              <p className="text-xs text-slate-500 mb-4">Events detected by multiple IDS engines simultaneously</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Source IP</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Destination IP</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Time</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Detected By</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400">Alerts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overlap.overlaps.slice(0, 20).map((evt, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="py-2 px-3 text-slate-300 font-mono text-xs">{evt.source_ip}</td>
                        <td className="py-2 px-3 text-slate-300 font-mono text-xs">{evt.destination_ip}</td>
                        <td className="py-2 px-3 text-slate-400 text-xs">{evt.time_bucket ? formatTime(evt.time_bucket) : '-'}</td>
                        <td className="py-2 px-3">
                          <div className="flex gap-1 flex-wrap">
                            {(evt.ids_sources || []).map(ids => (
                              <span key={ids} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: IDS_COLORS[ids] + '20', color: IDS_COLORS[ids] }}>
                                {IDS_LABELS[ids]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center text-white font-semibold">{evt.alert_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
