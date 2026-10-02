'use client';

import React, { useMemo, useState } from 'react';
import { Boxes, RefreshCw } from 'lucide-react';
import { fmt, fmtCompact } from './shared';
import { Card } from './ui';
import { useApi, th, td, num } from './useApi';

type Stock = {
  asOf: string;
  products: {
    id: number; name: string; price: number; stock: number; unitCost: number; specificCost: boolean; costValue: number; retailValue: number;
    sold30: number; sold90: number; coverDays: number | null;
    variants: { id: number; size: string; stock: number; sold30: number; coverDays: number | null }[];
  }[];
  totals: { units: number; costValue: number; retailValue: number; sold30: number; coverDays: number | null; deadUnits: number; deadValue: number };
};

type Filter = 'all' | 'low' | 'dead';

const coverText = (d: number | null, stock: number) => (stock === 0 ? 'Sold out' : d == null ? 'No sales' : d > 365 ? '1 yr+' : `${Math.round(d)} days`);
const coverColor = (d: number | null, stock: number) => (stock === 0 ? '#b91c1c' : d == null ? '#94a3b8' : d < 14 ? '#b91c1c' : d < 30 ? '#b45309' : d > 180 ? '#64748b' : '#15803d');

/** Stock on hand valued at production cost, with how long it lasts at the current sales pace. */
export const StockPanel = () => {
  const { data, error, loading, reload } = useApi<Stock>('/api/finance/stock');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const list = data?.products || [];
    if (filter === 'low') return list.filter(p => p.sold30 > 0 && (p.stock === 0 || (p.coverDays ?? Infinity) < 30 || p.variants.some(v => v.sold30 > 0 && v.stock === 0)));
    if (filter === 'dead') return list.filter(p => p.stock > 0 && p.sold90 === 0);
    return list;
  }, [data, filter]);

  const t = data?.totals;
  return (
    <Card
      title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Boxes size={15} /> Stock on hand</span>}
      subtitle="Live from WooCommerce, valued at unit cost · how long each product lasts at the last 30 days’ sales pace"
      action={<button type="button" onClick={() => reload(true)} aria-label="Refresh stock" style={{ border: '1px solid #e2e7ee', background: '#fff', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'inline-flex' }}><RefreshCw size={13} /></button>}
    >
      {loading && !data && <div className="fin-loading-bar" />}
      {error && <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.8rem' }}>{error}</p>}
      {t && (
        <>
          <div className="fin-kpi-grid" style={{ marginBottom: 14 }}>
            <Mini label="Stock value (at cost)" value={fmt(t.costValue)} sub={`${t.units.toLocaleString()} units`} />
            <Mini label="At selling price" value={fmt(t.retailValue)} sub={`${fmtCompact(t.retailValue - t.costValue)} potential gross profit`} />
            <Mini label="Lasts" value={t.coverDays ? `${Math.round(t.coverDays)} days` : '—'} sub={`selling ${t.sold30} units / 30 days`} />
            <Mini label="Not sold in 90 days" value={fmt(t.deadValue)} sub={`${t.deadUnits} units tied up`} tone={t.deadValue > 0 ? '#b45309' : undefined} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {([['all', `All (${data!.products.length})`], ['low', 'Running low'], ['dead', 'Not selling']] as [Filter, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                style={{ border: '1px solid #e2e7ee', borderRadius: 99, padding: '4px 11px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', background: filter === k ? '#0f172a' : '#fff', color: filter === k ? '#fff' : '#334155' }}>{l}</button>
            ))}
          </div>
          <div className="fin-table-scroll" style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={th}>Product</th><th style={th}>Sizes (in stock)</th><th style={{ ...th, ...num }}>Units</th>
                  <th style={{ ...th, ...num }}>Sold 30d</th><th style={{ ...th, ...num }}>Lasts</th><th style={{ ...th, ...num }}>Value at cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.id} className="fin-row">
                    <td style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {p.variants.map(v => (
                          <span key={v.id} title={`${v.size}: ${v.stock} in stock, ${v.sold30} sold in 30 days`}
                            style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5, fontVariantNumeric: 'tabular-nums',
                              background: v.stock === 0 ? (v.sold30 > 0 ? '#fee2e2' : '#f1f5f9') : '#f8fafc',
                              color: v.stock === 0 ? (v.sold30 > 0 ? '#b91c1c' : '#94a3b8') : '#334155',
                              border: '1px solid #eef1f5', textDecoration: v.stock === 0 && v.sold30 === 0 ? 'line-through' : undefined }}>
                            {v.size} {v.stock}
                          </span>
                        ))}
                        {!p.variants.length && <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ ...td, ...num }}>{p.stock}</td>
                    <td style={{ ...td, ...num }}>{p.sold30 || <span style={{ color: '#cbd5e1' }}>0</span>}</td>
                    <td style={{ ...td, ...num, fontWeight: 700, color: coverColor(p.coverDays, p.stock) }}>{coverText(p.coverDays, p.stock)}</td>
                    <td style={{ ...td, ...num }} title={`${p.stock} × ${fmt(p.unitCost)}${p.specificCost ? '' : ' (default cost)'}`}>{fmt(p.costValue)}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 24 }}>Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>Red sizes are sold out but still selling — each one is lost sales. Restock suggestions with quantities are in Scale Ops.</p>
        </>
      )}
    </Card>
  );
};

const Mini = ({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) => (
  <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 9 }}>
    <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: tone || '#0f172a', margin: '3px 0 1px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{sub}</div>
  </div>
);
