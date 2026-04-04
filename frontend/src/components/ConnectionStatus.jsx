import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function ConnectionStatus({ connected, error, onReconnect }) {
  if (connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-xs font-medium text-emerald-400">Live</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
      <WifiOff className="w-3 h-3 text-red-400" />
      <span className="text-xs font-medium text-red-400">
        {error || 'Disconnected'}
      </span>
      <button
        onClick={onReconnect}
        className="text-red-400 hover:text-red-300 cursor-pointer"
        title="Reconnect"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
    </div>
  );
}
