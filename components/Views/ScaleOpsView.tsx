'use client';

import React from 'react';
import { Panel } from '@/components/Common/Panel';
import { useScaleOpsData } from '@/lib/hooks/useData';

export const ScaleOpsView: React.FC = () => {
  const scaleOps = useScaleOpsData();

  const getStatusStyle = (isActive: boolean) => ({
    fontSize: '0.875rem',
    backgroundColor: isActive ? '#d4edda' : '#fff3cd',
    color: isActive ? '#155724' : '#856404',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
  });

  const getStatusLabel = (isActive: boolean) => (isActive ? '✓ Active' : '⏸️ Paused');

  return (
    <section className="view" id="scale-view" data-title="Scale Ops">
      <div className="content-grid">
        <Panel
          title="Operating System"
          subtitle="Processes needed as order volume grows."
          className="wide-panel"
        >
          <div className="ops-grid" id="ops-grid">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {scaleOps.processes.map((process: any) => (
                <div
                  key={process.name}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '0.5rem',
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <h3>{process.name}</h3>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                    {process.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          title="Automations"
          subtitle="Rules that reduce manual work."
        >
          <div className="automation-list" id="automation-list">
            <div style={{ padding: '1rem' }}>
              {scaleOps.automations.map((automation: any, idx: number) => (
                <div
                  key={automation.name}
                  style={{
                    marginBottom: idx === scaleOps.automations.length - 1 ? 0 : '1.5rem',
                    paddingBottom: idx === scaleOps.automations.length - 1 ? 0 : '1rem',
                    borderBottom: idx === scaleOps.automations.length - 1 ? 'none' : '1px solid #e0e0e0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong>{automation.name}</strong>
                    <span style={getStatusStyle(automation.isActive)}>
                      {getStatusLabel(automation.isActive)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    {automation.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
};
