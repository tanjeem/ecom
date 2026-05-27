import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface StockAlertItem {
  sku: string;
  product: string;
  current: number;
  reorderPoint: number;
}

interface StockAlertsProps {
  alerts: StockAlertItem[];
}

export const StockAlerts: React.FC<StockAlertsProps> = ({ alerts }) => {
  return (
    <div className="alert-list" id="stock-alerts">
      {alerts.length === 0 ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
          No stock alerts
        </p>
      ) : (
        alerts.map((alert) => (
          <div
            key={alert.sku}
            style={{
              padding: '1rem',
              borderLeft: '3px solid #ff6b6b',
              marginBottom: '0.5rem',
              backgroundColor: '#fff5f5',
              borderRadius: '0.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} color="#ff6b6b" />
              <strong>{alert.product}</strong>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
              SKU: {alert.sku} | Current: {alert.current} | Reorder: {alert.reorderPoint}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
