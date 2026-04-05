import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { useAuth } from './AuthContext';

const SSEContext = createContext(null);

const MAX_RECONNECT_DELAY = 16000;

export function SSEProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectDelayRef = useRef(1000);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_CONFIG.LOG_BASE_URL}/api/sse/alerts?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
      reconnectDelayRef.current = 1000;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_alert') {
          setAlerts((prev) => {
            if (prev.some((a) => a.id === data.alert.id)) return prev;
            return [data.alert, ...prev];
          });
        } else if (data.type === 'stats_update') {
          setStats(data.stats);
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();

      const delay = reconnectDelayRef.current;
      setError(`Reconnecting in ${delay / 1000}s...`);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
        connect();
      }, delay);
    };
  }, []);

  const loadRecentAlerts = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      const res = await axios.get(`${API_CONFIG.LOG_BASE_URL}/api/alerts`, {
        params: { page: 1, page_size: 10, dismissed: false },
        headers: { Authorization: `Bearer ${token}` },
      });
      const existing = (res.data.alerts || []).map((a) => ({
        id: a.id,
        severity: a.severity,
        category: a.category,
        source_ip: a.source_ip,
        destination_ip: a.destination_ip,
        source_port: a.source_port,
        destination_port: a.destination_port,
        protocol: a.protocol,
        threat_score: a.threat_score,
        ids_source: a.ids_source,
        flagged_by_threatfox: a.flagged_by_threatfox,
        is_blocked: a.is_blocked,
        quarantine_status: a.quarantine_status,
        ml_confidence: a.ml_confidence,
        geo_country: a.geo_country,
        detected_at: a.detected_at,
        created_at: a.created_at,
      }));
      setAlerts(existing);
    } catch {
      // Silent fail
    }
  }, []);

  // React to auth state changes — reset and reconnect on user change, disconnect on logout
  useEffect(() => {
    if (isAuthenticated && user) {
      // Clear previous user's data
      setAlerts([]);
      setStats(null);
      setError(null);
      reconnectDelayRef.current = 1000;

      loadRecentAlerts();
      connect();
    } else {
      // Logged out — disconnect and clear
      disconnect();
      setAlerts([]);
      setStats(null);
      setError(null);
    }

    return disconnect;
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissAlert = useCallback((alertId) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    const token = localStorage.getItem('accessToken');
    if (token) {
      axios.post(`${API_CONFIG.LOG_BASE_URL}/api/alerts/${alertId}/dismiss-feed`, null, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, []);

  const dismissAllAlerts = useCallback(() => {
    setAlerts([]);
    const token = localStorage.getItem('accessToken');
    if (token) {
      axios.post(`${API_CONFIG.LOG_BASE_URL}/api/alerts/dismiss-feed`, null, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, []);

  return (
    <SSEContext.Provider
      value={{ alerts, stats, connected, error, reconnect: connect, dismissAlert, dismissAllAlerts }}
    >
      {children}
    </SSEContext.Provider>
  );
}

export function useSSE() {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error('useSSE must be used within an SSEProvider');
  }
  return context;
}
