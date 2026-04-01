import { useState, useEffect } from 'react';
import { ShieldAlert, Search, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { alertService } from '../services/alertService';

const confidenceColor = (level) => {
  if (level >= 75) return 'bg-red-500/15 text-red-400 border-red-500/30';
  if (level >= 50) return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  if (level >= 25) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
};

const threatTypeColors = {
  botnet_cc: 'bg-red-500/15 text-red-400',
  payload_delivery: 'bg-orange-500/15 text-orange-400',
  c2: 'bg-purple-500/15 text-purple-400',
};

export default function ThreatIntel() {
  const [iocs, setIocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const fetchIOCs = async () => {
    setLoading(true);
    setError(null);
    setSearchResults(null);
    try {
      const data = await alertService.getRecentIOCs({ days, limit: 200 });
      if (data.error) {
        setError(data.error);
      } else {
        setIocs(data.iocs);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch ThreatFox data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIOCs();
  }, [days]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const data = await alertService.searchIOC(search.trim());
      if (data.error) {
        setError(data.error);
      } else {
        setSearchResults(data.results);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearch('');
    setSearchResults(null);
  };

  const displayData = searchResults !== null ? searchResults : iocs;

  // Stats from current data
  const malwareFamilies = new Set(displayData.map((i) => i.malware).filter(Boolean));
  const threatTypes = new Set(displayData.map((i) => i.threat_type).filter(Boolean));
  const iocTypes = {};
  displayData.forEach((i) => {
    const t = i.ioc_type || 'other';
    iocTypes[t] = (iocTypes[t] || 0) + 1;
  });

  const selectClass =
    'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 transition-all cursor-pointer appearance-none';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Threat Intelligence</h1>
        </div>
        <span className="text-sm text-slate-500">
          Live feed from{' '}
          <a href="https://threatfox.abuse.ch" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
            ThreatFox
          </a>
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total IOCs</p>
          <p className="text-2xl font-bold text-white">{displayData.length}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Malware Families</p>
          <p className="text-2xl font-bold text-red-400">{malwareFamilies.size}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Threat Types</p>
          <p className="text-2xl font-bold text-orange-400">{threatTypes.size}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">IOC Types</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(iocTypes).map(([type, count]) => (
              <span key={type} className="text-xs px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">
                {type}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectClass}>
          <option value={1}>Last 24 hours</option>
          <option value={3}>Last 3 days</option>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>

        <button
          onClick={fetchIOCs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[250px] max-w-lg">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 flex-1">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search IOC (IP, hash, domain)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-white placeholder-slate-600 outline-none w-full"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !search.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
          {searchResults !== null && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {searchResults !== null && (
        <div className="text-sm text-slate-400">
          Showing {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "<span className="text-white">{search}</span>"
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center py-16">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-2" />
          <span className="text-sm text-slate-500">Fetching latest threats from ThreatFox...</span>
        </div>
      ) : displayData.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 text-center">
          <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No IOCs found</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['IOC', 'Type', 'Malware', 'Threat Type', 'Confidence', 'First Seen', 'Reporter', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((ioc, i) => (
                  <tr key={ioc.id || i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-mono max-w-[220px] truncate" title={ioc.ioc}>
                      {ioc.ioc}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
                        {ioc.ioc_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{ioc.malware || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${threatTypeColors[ioc.threat_type] || 'bg-white/[0.06] text-slate-300'}`}>
                        {ioc.threat_type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${confidenceColor(ioc.confidence_level)}`}>
                        {ioc.confidence_level}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{ioc.first_seen || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{ioc.reporter || '—'}</td>
                    <td className="px-4 py-3">
                      {ioc.reference && (
                        <a
                          href={ioc.reference}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tags summary at the bottom */}
          <div className="border-t border-white/[0.06] px-4 py-3">
            <p className="text-xs text-slate-500 mb-2">Top Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const tagCount = {};
                displayData.forEach((ioc) => (ioc.tags || []).forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
                return Object.entries(tagCount)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 20)
                  .map(([tag, count]) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-lg bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                      {tag} <span className="text-slate-500">({count})</span>
                    </span>
                  ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
