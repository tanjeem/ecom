import React from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  children,
  actions,
  className = '',
  style,
}) => {
  return (
    <section className={`panel ${className}`} style={style}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
};
