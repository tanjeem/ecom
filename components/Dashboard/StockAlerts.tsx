import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

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
    <div className="alert-list" id="stock-alerts" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {alerts.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px dashed #e2e8f0',
        }}>
          <ShieldCheck size={32} color="#10b981" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
            All variants fully stocked
          </p>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
            No items below reorder points.
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
          {alerts.map((alert) => (
            <div
              key={alert.sku}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                marginBottom: 4,
                backgroundColor: '#fff5f5',
                border: '1px solid #fee2e2',
                borderLeft: '4px solid #ef4444',
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: '#fee2e2',
                  color: '#ef4444',
                  flexShrink: 0,
                }}>
                  <AlertTriangle size={13} strokeWidth={2.5} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: '#1e293b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {alert.product}
                  </strong>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#b91c1c',
                }}>
                  {alert.current}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: 2 }}>
                  / {alert.reorderPoint} left
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
