'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Check, X, Pencil, Package, Info } from 'lucide-react';
import { fmt, fmtPct, inputStyle } from './shared';
import { KpiCard, LoadingState, ErrorState, EmptyState, useToasts, ToastStack } from './ui';
import { usePeriod, invalidateFinanceCache } from './period';

type Product = {
  product_id: number; name: string; unitCost: number; specificCost: boolean;
  units: number; orders: number; revenue: number; cogs: number; fees: number;
  returnedUnits: number; returnFees: number; ads: number; profit: number; margin: number; returnRate: number;
};
type Report = {
  products: Product[];
  unlinked: { orders: number; revenue: number; cogs: number; fees: number; returnFees: number; returns: number; ads: number };
  adSpend: number; fallbackUnitCost: number; cogsMethod: string;
};
type SortKey = 'name' | 'units' | 'revenue' | 'profit' | 'margin' | 'returnRate' | 'unitCost';

export const FinanceProducts: React.FC = () => {
  const { range, label } = usePeriod();
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'revenue', dir: 'desc' });
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const { toasts, push, dismiss } = useToasts();

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/finance/products?from=${range.from}&to=${range.to}`, { signal: ctrl.signal })
      .then(async r => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || 'Failed'); return j; })
      .then(j => { setData(j); setError(null); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [range.from, range.to, nonce]);

  const rows = useMemo(() => {
    const list = (data?.products || []).slice();
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => (sort.key === 'name' ? a.name.localeCompare(b.name) : (a[sort.key] - b[sort.key])) * dir);
    return list;
  }, [data, sort]);

  const saveCost = async (p: Product, value: string) => {
    try {
      const res = await fetch('/api/finance/products', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: p.product_id, name: p.name, unit_cost: value === '' ? null : Number(value) }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Save failed');
      push({ text: value === '' ? `${p.name} now uses the default cost` : `${p.name}: ৳${value} per unit` });
      setEditing(null);
      invalidateFinanceCache();
      setNonce(n => n + 1);
    } catch (e: any) {
      push({ text: e.message, tone: 'error' });
    }
  };

  if (!data && loading) return <LoadingState label="Working out profit per product…" />;
  if (!data && error) return <ErrorState message="Could not build the product report" hint={error} onRetry={() => setNonce(n => n + 1)} />;
  if (!data) return null;

  const sold = data.products.filter(p => p.units > 0);
  const totals = sold.reduce((t, p) => ({ revenue: t.revenue + p.revenue, profit: t.profit + p.profit, units: t.units + p.units }), { revenue: 0, profit: 0, units: 0 });
  const unpriced = sold.filter(p => !p.specificCost).length;
  const best = sold.filter(p => p.revenue > 0).sort((a, b) => b.profit - a.profit)[0];
  const worst = sold.filter(p => p.units >= 3).sort((a, b) => a.margin - b.margin)[0];
  const u = data.unlinked;
  const unlinkedProfit = u.revenue - u.cogs - u.fees - u.returnFees - u.ads;

  const th = (text: string, key?: SortKey, align: 'left' | 'right' = 'right') => (
    <th className={key ? 'fin-th-sort' : undefined} onClick={key ? () => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' })) : undefined}
      style={{ padding: '9px 10px', textAlign: align, fontSize: '0.66rem', fontWeight: 800, color: sort.key === key ? '#0f172a' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap', background: '#f9fafb', position: 'sticky', top: 0 }}>
      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>{text}{key && sort.key === key && (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</span>
    </th>
  );
  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: loading ? 0.65 : 1 }}>
      {loading && <div className="fin-loading-bar" style={{ marginTop: -10 }} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <KpiCard label="Products sold" value={sold.length} sub={`${Math.round(totals.units)} units · ${label}`} />
        <KpiCard label="Product profit" value={fmt(totals.profit)} tone={totals.profit >= 0 ? 'good' : 'bad'} sub={`${totals.revenue ? fmtPct((totals.profit / totals.revenue) * 100) : '—'} after cost, fees, returns & ads`} />
        <KpiCard label="Most profitable" value={best ? best.name : '—'} sub={best ? `${fmt(best.profit)} profit · ${fmtPct(best.margin)}` : undefined} />
        <KpiCard label="Weakest margin" value={worst ? worst.name : '—'} tone={worst && worst.margin < 0 ? 'bad' : undefined} sub={worst ? `${fmtPct(worst.margin)} margin · ${fmtPct(worst.returnRate)} returned` : 'Needs 3+ units sold'} />
      </div>

      {unpriced > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: '0.78rem', color: '#1e3a8a' }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>{unpriced} of {sold.length} products use the default cost of <b>{fmt(data.fallbackUnitCost)}</b>/unit. Click a unit cost to set the real one — every report updates instantly.</div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <EmptyState bare icon={Package} title={`No invoiced sales linked to products in ${label}`} hint="Deliveries link to products through the WooCommerce order id on the Pathao parcel." />
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 980 }}>
              <thead>
                <tr>
                  {th('Product', 'name', 'left')}
                  {th('Unit cost', 'unitCost')}
                  {th('Units', 'units')}
                  {th('Revenue', 'revenue')}
                  {th('Product cost')}
                  {th('Pathao fees')}
                  {th('Returns', 'returnRate')}
                  {th('Ads share')}
                  {th('Profit', 'profit')}
                  {th('Margin', 'margin')}
                </tr>
              </thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.product_id} className="fin-row">
                    <td style={{ ...cell, textAlign: 'left', fontWeight: 700, color: '#0f172a', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</td>
                    <td style={cell}>
                      {editing?.id === p.product_id ? (
                        <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                          <input autoFocus type="number" min="0" value={editing.value} placeholder="default"
                            onChange={e => setEditing({ id: p.product_id, value: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') saveCost(p, editing.value); if (e.key === 'Escape') setEditing(null); }}
                            style={{ ...inputStyle, width: 86, padding: '4px 6px', fontSize: '0.78rem', textAlign: 'right' }} />
                          <button type="button" aria-label="Save cost" onClick={() => saveCost(p, editing.value)} style={{ border: 'none', background: 'none', color: '#15803d', cursor: 'pointer', display: 'flex', padding: 3 }}><Check size={14} /></button>
                          <button type="button" aria-label="Cancel" onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', padding: 3 }}><X size={14} /></button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setEditing({ id: p.product_id, value: p.specificCost ? String(p.unitCost) : '' })}
                          title={p.specificCost ? 'Product-specific cost' : 'Using the default cost — click to set'}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: p.specificCost ? '#0f172a' : '#94a3b8', fontStyle: p.specificCost ? 'normal' : 'italic' }}>
                          {fmt(p.unitCost)} <Pencil size={11} />
                        </button>
                      )}
                    </td>
                    <td style={cell}>{p.units}</td>
                    <td style={{ ...cell, color: '#0f172a', fontWeight: 600 }}>{fmt(p.revenue)}</td>
                    <td style={{ ...cell, color: '#64748b' }}>{fmt(p.cogs)}</td>
                    <td style={{ ...cell, color: '#64748b' }}>{fmt(p.fees)}</td>
                    <td style={{ ...cell, color: p.returnRate >= 30 ? '#b91c1c' : '#64748b' }} title={`${p.returnedUnits} units returned · ${fmt(p.returnFees)} return fees`}>
                      {p.returnedUnits ? `${fmtPct(p.returnRate, 0)} · ${fmt(p.returnFees)}` : '—'}
                    </td>
                    <td style={{ ...cell, color: '#64748b' }}>{fmt(p.ads)}</td>
                    <td style={{ ...cell, fontWeight: 800, color: p.profit >= 0 ? '#15803d' : '#b91c1c' }}>{fmt(p.profit)}</td>
                    <td style={{ ...cell, fontWeight: 700, color: p.margin >= 0 ? '#0f172a' : '#b91c1c' }}>{p.revenue ? fmtPct(p.margin) : '—'}</td>
                  </tr>
                ))}
                {u.orders > 0 && (
                  <tr style={{ background: '#fafbfc' }}>
                    <td style={{ ...cell, textAlign: 'left', color: '#64748b', fontStyle: 'italic' }} title="Parcels without a WooCommerce order id — priced at the default unit cost">Orders not linked to a product ({u.orders})</td>
                    <td style={{ ...cell, color: '#94a3b8' }}>{fmt(data.fallbackUnitCost)}</td>
                    <td style={{ ...cell, color: '#94a3b8' }}>—</td>
                    <td style={cell}>{fmt(u.revenue)}</td>
                    <td style={{ ...cell, color: '#64748b' }}>{fmt(u.cogs)}</td>
                    <td style={{ ...cell, color: '#64748b' }}>{fmt(u.fees)}</td>
                    <td style={{ ...cell, color: '#64748b' }}>{u.returns ? `${u.returns} · ${fmt(u.returnFees)}` : '—'}</td>
                    <td style={{ ...cell, color: '#64748b' }}>{fmt(u.ads)}</td>
                    <td style={{ ...cell, fontWeight: 700, color: unlinkedProfit >= 0 ? '#15803d' : '#b91c1c' }}>{fmt(unlinkedProfit)}</td>
                    <td style={cell}>{u.revenue ? fmtPct((unlinkedProfit / u.revenue) * 100) : '—'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.5 }}>
        Revenue and Pathao fees come from paid invoices, split across an order’s items by WooCommerce line value. Returns come from return invoices.
        Ad spend ({fmt(data.adSpend)}) is shared out by revenue. Rent, salary and other overheads are not allocated to products.
      </p>
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
};
