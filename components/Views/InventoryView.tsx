'use client';

import React from 'react';
import { Panel } from '@/components/Common/Panel';
import { useInventoryData } from '@/lib/hooks/useData';

export const InventoryView: React.FC = () => {
  const inventory = useInventoryData();

  return (
    <section className="view" id="inventory-view" data-title="Inventory">
      <div className="content-grid inventory-layout">
        <Panel
          title="Variant Matrix"
          subtitle="Color and size availability across active clothing lines."
          className="wide-panel"
        >
          <div className="inventory-grid" id="inventory-grid">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>XS</th>
                  <th>S</th>
                  <th>M</th>
                  <th>L</th>
                  <th>XL</th>
                </tr>
              </thead>
              <tbody>
                {inventory.items.map((item: any) => (
                  <tr key={item.product}>
                    <td>{item.product}</td>
                    <td>{item.sizes.XS}</td>
                    <td>{item.sizes.S}</td>
                    <td>{item.sizes.M}</td>
                    <td>{item.sizes.L}</td>
                    <td>{item.sizes.XL}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Demand Forecast"
          subtitle="Projected sell-through based on current campaigns."
        >
          <div className="forecast-list" id="forecast-list">
            <div style={{ padding: '1rem' }}>
              {inventory.forecasts.map((forecast: any) => {
                const getProgressColor = (percentage: number) => {
                  if (percentage > 80) return '#ff6b6b';
                  if (percentage > 70) return '#90ee90';
                  return '#ffa500';
                };

                return (
                  <div key={forecast.product} style={{ marginBottom: '1.5rem' }}>
                    <strong>{forecast.product}</strong>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                      Weekly demand: {forecast.weeklyDemand} units | Current stock: {forecast.currentStock}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '4px',
                        marginTop: '0.5rem',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${forecast.percentage}%`,
                          height: '100%',
                          backgroundColor: getProgressColor(forecast.percentage),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
};
