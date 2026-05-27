import React from 'react';

interface OrderPipelineProps {
  stages: { name: string; count: number }[];
}

export const OrderPipeline: React.FC<OrderPipelineProps> = ({ stages }) => {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <div className="pipeline" id="pipeline">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        {stages.map((stage) => (
          <div
            key={stage.name}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '0.5rem',
            }}
          >
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              {stage.name}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
              {stage.count}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
              {((stage.count / total) * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
