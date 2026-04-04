import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const severityColors = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#94a3b8',
};

export function useAlertNotifications(alerts) {
  const prevCountRef = useRef(0);
  const permissionRef = useRef(Notification.permission);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    }
  }, []);

  // React to new alerts
  useEffect(() => {
    if (alerts.length <= prevCountRef.current) {
      prevCountRef.current = alerts.length;
      return;
    }

    // Only process truly new alerts (ones added since last check)
    const newCount = alerts.length - prevCountRef.current;
    const newAlerts = alerts.slice(0, newCount);
    prevCountRef.current = alerts.length;

    newAlerts.forEach((alert) => {
      const isCritical = alert.severity === 'CRITICAL';
      const isHigh = alert.severity === 'HIGH';

      // Toast notification for HIGH and CRITICAL
      if (isCritical || isHigh) {
        toast(
          (t) => (
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => toast.dismiss(t.id)}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>
                {isCritical ? 'Critical Threat Detected' : 'High Severity Alert'}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                {alert.category} from {alert.source_ip}
              </div>
            </div>
          ),
          {
            duration: 5000,
            position: 'bottom-right',
            style: {
              background: '#1e1e2e',
              border: `1px solid ${isCritical ? '#ef444440' : '#f9731640'}`,
              borderLeft: `3px solid ${isCritical ? '#ef4444' : '#f97316'}`,
              color: '#fff',
              padding: '12px 16px',
            },
          },
        );
      }

      // Desktop notification for CRITICAL
      if (isCritical && permissionRef.current === 'granted') {
        try {
          const notif = new Notification('Critical Threat Detected', {
            body: `${alert.category} from ${alert.source_ip}`,
            icon: '/vite.svg',
            tag: alert.id,
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        } catch {
          // Desktop notifications may fail in some contexts
        }
      }
    });
  }, [alerts]);
}
