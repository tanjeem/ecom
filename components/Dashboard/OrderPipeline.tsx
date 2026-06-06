import React from 'react';

interface OrderPipelineProps {
  stages: { name: string; count: number }[];
}

export const OrderPipeline: React.FC<OrderPipelineProps> = ({ stages }) => {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  const getStageColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'processing':
        return '#3b82f6'; // blue
      case 'packed':
        return '#10b981'; // green
      case 'hold':
        return '#f59e0b'; // amber
      case 'dispatched':
        return '#6366f1'; // indigo
      case 'completed':
        return '#0f766e'; // teal
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className="order-pipeline" style={{ width: '100%' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 8,
        width: '100%'
      }}>
        {stages.map((stage) => {
          const color = getStageColor(stage.name);
          const percent = total > 0 ? ((stage.count / total) * 100).toFixed(0) : '0';

          return (
            <div
              key={stage.name}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: `3px solid ${color}`,
                borderRadius: 6,
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
              }}
              className="pipeline-card"
            >
              <div style={{
                fontSize: '0.65rem',
                color: '#64748b',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 4
              }}>
                {stage.name}
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 850,
                color: '#1e293b',
                lineHeight: 1
              }}>
                {stage.count}
                <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 400, marginLeft: 2 }}>
                  orders
                </span>
              </div>
              <div style={{
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <div style={{
                  flex: 1,
                  height: 3,
                  backgroundColor: '#f1f5f9',
                  borderRadius: 1.5,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percent}%`,
                    height: '100%',
                    backgroundColor: color,
                    borderRadius: 1.5
                  }} />
                </div>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 650,
                  color: color
                }}>
                  {percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
