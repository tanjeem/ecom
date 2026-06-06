import React from 'react';

interface CashMeterProps {
  available: number;
  receivables: number;
  projected: number;
  currency?: string;
}

export const CashMeter: React.FC<CashMeterProps> = ({
  available,
  receivables,
  projected,
  currency = '৳ ',
}) => {
  const total = projected;
  const percentage = total > 0 ? (available / total) * 100 : 0;

  return (
    <div className="cash-meter" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="cash-track" style={{
        height: 8,
        overflow: 'hidden',
        borderRadius: 999,
        background: '#e2e8f0',
        position: 'relative'
      }}>
        <span style={{
          display: 'block',
          height: '100%',
          borderRadius: 'inherit',
          background: 'linear-gradient(90deg, #10b981, #3b82f6)',
          width: `${percentage}%`,
          transition: 'width 0.5s ease-out'
        }}></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
        <div style={{
          padding: '8px 10px',
          background: '#f8fafc',
          borderRadius: 6,
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ display: 'block', fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available Cash</span>
          <strong style={{ display: 'block', fontSize: '1.05rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>
            {currency}
            {available.toLocaleString()}
          </strong>
        </div>
        <div style={{
          padding: '8px 10px',
          background: '#f8fafc',
          borderRadius: 6,
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ display: 'block', fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Payouts</span>
          <strong style={{ display: 'block', fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
            {currency}
            {receivables.toLocaleString()}
          </strong>
        </div>
        <div style={{
          padding: '8px 10px',
          background: '#f8fafc',
          borderRadius: 6,
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ display: 'block', fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Projected Cash</span>
          <strong style={{ display: 'block', fontSize: '1.05rem', fontWeight: 800, color: '#3b82f6', marginTop: 2 }}>
            {currency}
            {projected.toLocaleString()}
          </strong>
        </div>
      </div>
    </div>
  );
};
