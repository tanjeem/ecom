'use client';

import React, { useEffect, useState } from 'react';
import { Panel } from '@/components/Common/Panel';

type SizeKey = 'S' | 'M' | 'L' | 'XL';

type InventoryItem = {
  product: string;
  sku: string;
  color: string;
  price: number;
  sizes: Record<SizeKey, number>;
  totalStock: number;
  weeklyDemand: number;
  percentage: number;
};

type LowStockAlert = {
  sku: string;
  product: string;
  current: number;
  reorderPoint: number;
};

function progressColor(percentage: number): string {
  if (percentage > 80) return '#ff6b6b';
  if (percentage > 50) return '#ffa500';
  return '#22c55e';
}

function getCellBg(qty: number): string {
  if (qty === 0) return '#e5e7eb';
  if (qty <= 3) return '#fee2e2';
  return 'transparent';
}

function getCellTextColor(qty: number): string {
  if (qty === 0) return '#9ca3af';
  if (qty <= 3) return '#c23a3a';
  return '#202124';
}

function StockCell({ qty }: { readonly qty: number }) {
  const color = getCellBg(qty);
  const textColor = getCellTextColor(qty);
  return (
    <td style={{ background: color, color: textColor, fontWeight: qty <= 3 ? 700 : 400, textAlign: 'center' }}>
      {qty}
    </td>
  );
}

export const InventoryView: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  const totalUnits = items.reduce((sum, i) => sum + i.totalStock, 0);
  const totalValue = items.reduce((sum, i) => sum + i.price * i.totalStock, 0);

  useEffect(() => {
    fetch('/api/inventory')
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setLowStock(data.lowStock ?? []);
        setIsMock(data.isMock ?? false);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section className="view" id="inventory-view" data-title="Inventory">
      {isMock && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem', color: '#92400e',
        }}>
          Showing sample data — WooCommerce products not found or not configured.
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 20px', flex: 1 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Units In Stock</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d', marginTop: 4 }}>{totalUnits.toLocaleString()}</div>
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 20px', flex: 1 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Stock Value</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d4ed8', marginTop: 4 }}>৳{totalValue.toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="content-grid inventory-layout">
        <Panel
          title="Variant Matrix"
          subtitle="Size availability per product. Red cells = low stock (≤3)."
          className="wide-panel"
        >
          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Loading inventory…</div>
          ) : (
            <div className="inventory-grid" id="inventory-grid">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>S</th>
                    <th style={{ textAlign: 'center' }}>M</th>
                    <th style={{ textAlign: 'center' }}>L</th>
                    <th style={{ textAlign: 'center' }}>XL</th>
                    <th style={{ textAlign: 'center' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.product}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.product}</div>
                        {item.color && (
                          <div style={{ fontSize: '0.72rem', color: '#68707a' }}>{item.color}</div>
                        )}
                      </td>
                      <StockCell qty={item.sizes.S} />
                      <StockCell qty={item.sizes.M} />
                      <StockCell qty={item.sizes.L} />
                      <StockCell qty={item.sizes.XL} />
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.totalStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No products found.</div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Stock Health" subtitle="Low stock alerts and demand forecast.">
          {isLoading ? (
            <div style={{ padding: '1rem', color: '#999' }}>Loading…</div>
          ) : (
            <div style={{ padding: '1rem' }}>
              {lowStock.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c23a3a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Low Stock Alerts
                  </div>
                  {lowStock.map((alert) => (
                    <div key={alert.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ fontSize: '0.83rem' }}>{alert.product}</span>
                      <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#c23a3a' }}>
                        {alert.current} / {alert.reorderPoint}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Demand Forecast
              </div>
              {items.map((item) => (
                <div key={item.product} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.product}</div>
                  <div style={{ fontSize: '0.78rem', color: '#68707a', marginTop: 2 }}>
                    Est. weekly demand: {item.weeklyDemand} units · Stock: {item.totalStock}
                  </div>
                  <div style={{ width: '100%', height: 7, background: '#e5e7eb', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, item.percentage)}%`, height: '100%', background: progressColor(item.percentage), borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>
                    {item.percentage}% weekly sell-through
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ color: '#999', fontSize: '0.875rem' }}>No forecast data.</div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
};
