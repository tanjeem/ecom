import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  subtitle: string;
  sentiment?: 'positive' | 'warning' | 'negative';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  sentiment,
}) => {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={sentiment || ''}>
        {subtitle}
      </small>
    </article>
  );
};
