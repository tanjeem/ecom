import React from 'react';

interface CashMeterProps {
  available: number;
  obligations: number;
  surplus: number;
  currency?: string;
}

export const CashMeter: React.FC<CashMeterProps> = ({
  available,
  obligations,
  surplus,
  currency = '$',
}) => {
  const percentage = (available / (available + obligations)) * 100;

  return (
    <div className="cash-meter">
      <div className="cash-track">
        <span style={{ width: `${percentage}%` }}></span>
      </div>
      <div className="cash-row">
        <span>Available</span>
        <strong>
          {currency}
          {available.toLocaleString()}
        </strong>
      </div>
      <div className="cash-row">
        <span>Next 14 day obligations</span>
        <strong>
          {currency}
          {obligations.toLocaleString()}
        </strong>
      </div>
      <div className="cash-row">
        <span>Projected surplus</span>
        <strong>
          {currency}
          {surplus.toLocaleString()}
        </strong>
      </div>
    </div>
  );
};
