import { useState, useEffect, useRef } from 'react';
import {
  BarChart3, Loader2, Download, Image, RotateCcw,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import html2canvas from 'html2canvas';
import { alertService } from '../services/alertService';

// ── Color palettes ──
const PALETTES = {
  default: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6'],
  red:     ['#EF4444', '#F87171', '#FCA5A5', '#DC2626', '#B91C1C', '#991B1B', '#FECACA', '#FEE2E2', '#F43F5E', '#E11D48'],
  blue:    ['#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#1D4ED8', '#1E40AF', '#BFDBFE', '#DBEAFE', '#6366F1', '#4F46E5'],
  purple:  ['#8B5CF6', '#A78BFA', '#C4B5FD', '#7C3AED', '#6D28D9', '#5B21B6', '#DDD6FE', '#EDE9FE', '#A855F7', '#9333EA'],
  green:   ['#10B981', '#34D399', '#6EE7B7', '#059669', '#047857', '#065F46', '#A7F3D0', '#D1FAE5', '#14B8A6', '#0D9488'],
  warm:    ['#F59E0B', '#F97316', '#EF4444', '#EC4899', '#D946EF', '#8B5CF6', '#FBBF24', '#FB923C', '#F87171', '#F472B6'],
};

const DATE_RANGES = [
  { label: 'Past 24 hours', value: '24h' },
  { label: 'Past 7 days', value: '7d' },
  { label: 'Past 30 days', value: '30d' },
  { label: 'Past 90 days', value: '90d' },
];

const CHART_TYPES = [
  { value: 'line', label: 'Line chart' },
  { value: 'bar', label: 'Bar chart' },
  { value: 'pie', label: 'Pie chart' },
];

const PALETTE_LABELS = {
  default: 'Default',
  red: 'Red tones',
  blue: 'Blue tones',
  purple: 'Purple tones',
  green: 'Green tones',
  warm: 'Warm tones',
};

const CHART_INFO = {
  time: {
    title: 'Alerts Over Time',
    subtitle: 'How many alerts were detected in each time period',
  },
  category: {
    title: 'Category Breakdown',
    subtitle: 'Which types of threats are most common',
  },
  source: {
    title: 'Top Attacking IPs',
    subtitle: 'The IP addresses that triggered the most alerts',
  },
  severity: {
    title: 'Severity Trends',
    subtitle: 'How critical vs low-risk alerts change over time',
  },
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

// ── Custom Chart Component ──
function CustomChart({ config, data, colors }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-sm text-slate-500">No data available</div>;
  }

  const dataKey = 'count';

  if (config.chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey={dataKey} nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#0f1320', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff' }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const ChartComp = config.chartType === 'bar' ? BarChart : LineChart;
  const DataComp = config.chartType === 'bar' ? Bar : Line;
  const dataProps = config.chartType === 'bar'
    ? { fill: colors[0] }
    : { stroke: colors[0], strokeWidth: 2, dot: false };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ChartComp data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: '#0f1320', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff' }} />
        <DataComp dataKey={dataKey} {...dataProps} />
      </ChartComp>
    </ResponsiveContainer>
  );
}

// ── Severity Trend Chart (always stacked bar) ──
function SeverityTrendChart({ data, colors }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-64 text-sm text-slate-500">No data available</div>;
  }
  const sevColors = { CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#F59E0B', LOW: '#64748B' };
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: '#0f1320', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff' }} />
        <Legend />
        <Bar dataKey="CRITICAL" stackId="a" fill={sevColors.CRITICAL} />
        <Bar dataKey="HIGH" stackId="a" fill={sevColors.HIGH} />
        <Bar dataKey="MEDIUM" stackId="a" fill={sevColors.MEDIUM} />
        <Bar dataKey="LOW" stackId="a" fill={sevColors.LOW} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Inline chart controls ──
function ChartControls({ config, onChange }) {
  const selectClass = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

  return (
    <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500">Show as</span>
        <select value={config.chartType} onChange={(e) => onChange({ ...config, chartType: e.target.value })} className={selectClass}>
          {CHART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500">Time period</span>
        <select value={config.range} onChange={(e) => onChange({ ...config, range: e.target.value })} className={selectClass}>
          {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500">Colors</span>
        <select value={config.palette} onChange={(e) => onChange({ ...config, palette: e.target.value })} className={selectClass}>
          {Object.keys(PALETTES).map(p => <option key={p} value={p}>{PALETTE_LABELS[p] || p}</option>)}
        </select>
      </div>
      <button onClick={() => onChange({ ...config, _refresh: Date.now() })} className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer">
        Update
      </button>
    </div>
  );
}

// ── Chart card wrapper ──
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
      <div ref={chartRef}>
        {children}
      </div>
    </div>
  );
}

// ── Main Analytics page ──
export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Chart configs
  const [timeConfig, setTimeConfig] = useState({ chartType: 'line', range: '24h', palette: 'default' });
  const [catConfig, setCatConfig] = useState({ chartType: 'pie', range: '7d', palette: 'default' });
  const [srcConfig, setSrcConfig] = useState({ chartType: 'bar', range: '7d', palette: 'blue' });
  const [sevConfig, setSevConfig] = useState({ chartType: 'bar', range: '7d', palette: 'default' });

  // Data
  const [timeData, setTimeData] = useState([]);
  const [catData, setCatData] = useState([]);
  const [srcData, setSrcData] = useState([]);
  const [sevData, setSevData] = useState([]);

  // Refs for PNG export
  const timeRef = useRef(null);
  const catRef = useRef(null);
  const srcRef = useRef(null);
  const sevRef = useRef(null);

  // Global filter
  const [globalRange, setGlobalRange] = useState('7d');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const timeRange = getDateRange(timeConfig.range);
      const catRange = getDateRange(catConfig.range);
      const srcRange = getDateRange(srcConfig.range);

      const [ts, cat, src, sev] = await Promise.all([
        alertService.getTimeSeries({ startDate: timeRange.startDate, endDate: timeRange.endDate, severity: severityFilter || undefined, category: categoryFilter || undefined }),
        alertService.getCategoryDistribution({ startDate: catRange.startDate, endDate: catRange.endDate, severity: severityFilter || undefined }),
        alertService.getTopSources({ startDate: srcRange.startDate, endDate: srcRange.endDate, severity: severityFilter || undefined, category: categoryFilter || undefined }),
        alertService.getSeverityTrends({ days: getDateRange(sevConfig.range).days, category: categoryFilter || undefined }),
      ]);

      setTimeData(ts.map(r => ({ name: formatTime(r.time), count: r.count })));
      setCatData(cat.map(r => ({ name: formatCategory(r.category), count: r.count })));
      setSrcData(src.map(r => ({ name: r.source_ip, count: r.count })));
      setSevData(sev.map(r => ({ name: formatTime(r.time), ...r })));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApplyAll = () => fetchAll();

  // CSV export
  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(r => keys.map(k => r[k]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const selectClass = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCSV(timeData, 'alerts-time-series.csv')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer" title="Download alert data as a spreadsheet file">
            <Download className="w-4 h-4" />
            Download data
          </button>
          <button onClick={handleApplyAll} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer" title="Reload all charts with current filters">
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Global filters */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4">
        <p className="text-xs text-slate-400 mb-3">Filter all charts — pick a risk level or attack type, then hit Refresh to update.</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Risk level</span>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className={selectClass}>
              <option value="">All levels</option>
              <option value="CRITICAL">Critical — most dangerous</option>
              <option value="HIGH">High — needs attention</option>
              <option value="MEDIUM">Medium — moderate risk</option>
              <option value="LOW">Low — informational</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Attack type</span>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
              <option value="">All types</option>
              {['SQL_INJECTION', 'DDOS', 'MALWARE', 'BRUTE_FORCE', 'XSS', 'PORT_SCAN', 'COMMAND_INJECTION', 'PRIVILEGE_ESCALATION', 'DATA_EXFILTRATION', 'ANOMALY'].map(c => (
                <option key={c} value={c}>{formatCategory(c)}</option>
              ))}
            </select>
          </div>
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
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Alerts over time */}
          <ChartCard title={CHART_INFO.time.title} subtitle={CHART_INFO.time.subtitle} chartRef={timeRef}>
            <CustomChart config={timeConfig} data={timeData} colors={PALETTES[timeConfig.palette]} />
            <ChartControls config={timeConfig} onChange={setTimeConfig} />
          </ChartCard>

          {/* Category distribution */}
          <ChartCard title={CHART_INFO.category.title} subtitle={CHART_INFO.category.subtitle} chartRef={catRef}>
            <CustomChart config={catConfig} data={catData} colors={PALETTES[catConfig.palette]} />
            <ChartControls config={catConfig} onChange={setCatConfig} />
          </ChartCard>

          {/* Top source IPs */}
          <ChartCard title={CHART_INFO.source.title} subtitle={CHART_INFO.source.subtitle} chartRef={srcRef}>
            <CustomChart config={srcConfig} data={srcData} colors={PALETTES[srcConfig.palette]} />
            <ChartControls config={srcConfig} onChange={setSrcConfig} />
          </ChartCard>

          {/* Severity trends */}
          <ChartCard title={CHART_INFO.severity.title} subtitle={CHART_INFO.severity.subtitle} chartRef={sevRef}>
            <SeverityTrendChart data={sevData} />
            <ChartControls config={sevConfig} onChange={setSevConfig} />
          </ChartCard>

        </div>
      )}
    </div>
  );
}
