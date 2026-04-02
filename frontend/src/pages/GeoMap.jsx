import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Globe as GlobeIcon, Loader2, RotateCcw } from 'lucide-react';
import { alertService } from '../services/alertService';

function getColor(avgScore) {
  if (avgScore >= 0.7) return '#FF3333';
  if (avgScore >= 0.4) return '#FFDD00';
  return '#00FFAA';
}

// ── Stats bar ──
function StatsBar({ data }) {
  if (!data || data.length === 0) return null;
  const totalAlerts = data.reduce((sum, d) => sum + d.alert_count, 0);
  const countries = new Set(data.map(d => d.country)).size;
  const highThreat = data.filter(d => d.avg_score >= 0.7).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Total Geolocated Alerts', value: totalAlerts, color: 'text-blue-400' },
        { label: 'Countries', value: countries, color: 'text-purple-400' },
        { label: 'High Threat Locations', value: highThreat, color: 'text-red-400' },
      ].map(s => (
        <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──
export default function GeoMap() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('7d');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[range] || 7;
      const start = new Date(now.getTime() - days * 86400000);
      const geo = await alertService.getGeoMap({ startDate: start.toISOString(), endDate: now.toISOString() });
      setData(geo);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load geo data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [range]);

  const maxCount = useMemo(() => Math.max(...(data || []).map(d => d.alert_count), 1), [data]);

  const selectClass = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <GlobeIcon className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">GeoIP Map</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={range} onChange={(e) => setRange(e.target.value)} className={selectClass}>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer">
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Stats */}
      <StatsBar data={data} />

      {/* Map */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <MapContainer
            center={[20, 0]}
            zoom={2}
            minZoom={2}
            maxZoom={10}
            scrollWheelZoom={true}
            zoomControl={false}
            attributionControl={false}
            style={{ height: '100%', width: '100%', background: '#1a1f2e' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            {data.map((point, i) => {
              const color = getColor(point.avg_score);
              const radius = Math.max(6, Math.min(30, (point.alert_count / maxCount) * 30));
              return (
                <CircleMarker
                  key={i}
                  center={[point.latitude, point.longitude]}
                  radius={radius}
                  pathOptions={{
                    color: '#fff',
                    fillColor: color,
                    fillOpacity: 0.8,
                    weight: 2,
                    opacity: 0.9,
                  }}
                >
                  <Popup>
                    <div style={{ color: '#1e293b', fontSize: 12, lineHeight: 1.6 }}>
                      <strong>{point.country}</strong><br />
                      Alerts: <strong>{point.alert_count}</strong><br />
                      Avg Threat Score: <strong>{point.avg_score}</strong>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#00FFAA' }} />
          Low threat (&lt;0.4)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#FFDD00' }} />
          Medium (0.4–0.7)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#FF3333' }} />
          High threat (&gt;0.7)
        </div>
        <span>|</span>
        <span>Circle size = alert count</span>
      </div>
    </div>
  );
}
