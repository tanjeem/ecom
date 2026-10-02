'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes, Wallet, Gauge, Timer, AlertTriangle, PackageX, Search, RefreshCw, Download, X, Plus, Minus, ClipboardCheck, History, Ruler,
} from 'lucide-react';
import { Card, KpiCard, LoadingState, ErrorState, Sparkline, useToasts, ToastStack } from '@/components/Finance/ui';
import { fmt, fmtCompact, CHART } from '@/components/Finance/shared';
import { useApi, th, td, num } from '@/components/Finance/useApi';

type Variant = { id: number; size: string; sku: string; stock: number; sold30: number; sold90: number; coverDays: number | null };
type Product = {
  id: number; name: string; sku: string; image: string | null; price: number; stock: number; unitCost: number; specificCost: boolean;
  costValue: number; retailValue: number; sold30: number; sold90: number; revenue90: number; sellThrough30: number;
  abc: 'A' | 'B' | 'C'; weekly: number[]; coverDays: number | null; variants: Variant[];
};
type Adjustment = { id: string; product_name: string; size: string | null; before_qty: number; after_qty: number; reason: string; note: string | null; created_by: string | null; created_at: string };
type Data = {
  asOf: string; products: Product[]; adjustments: Adjustment[];
  totals: { units: number; costValue: number; retailValue: number; sold30: number; coverDays: number | null; deadUnits: number; deadValue: number };
};

type Filter = 'all' | 'low' | 'sizes' | 'dead' | 'over';
type Sort = 'value' | 'stock' | 'sold' | 'cover' | 'sellthrough' | 'name';

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
const sizeRank = (s: string) => { const i = SIZE_ORDER.indexOf(s.toUpperCase()); return i < 0 ? 99 : i; };
const REASONS: { id: string; label: string }[] = [
  { id: 'restock', label: 'New stock arrived' }, { id: 'count', label: 'Stock count' }, { id: 'damaged', label: 'Damaged / lost' },
  { id: 'return', label: 'Customer return' }, { id: 'sample', label: 'Sample / gift' }, { id: 'other', label: 'Other' },
];
const OVERSTOCK_DAYS = 180;

const coverText = (d: number | null, stock: number) => (stock === 0 ? 'Sold out' : d == null ? 'No sales' : d > 365 ? '1 yr+' : `${Math.round(d)}d`);
const coverTone = (d: number | null, stock: number, sold: number) =>
  stock === 0 ? (sold > 0 ? 'out' : 'dead') : d == null ? 'idle' : d < 14 ? 'low' : d < 30 ? 'soon' : d > OVERSTOCK_DAYS ? 'over' : 'ok';
const TONE: Record<string, { bg: string; color: string; label: string }> = {
  out: { bg: '#fee2e2', color: '#b91c1c', label: 'Sold out, still selling' },
  low: { bg: '#ffedd5', color: '#c2410c', label: 'Under 2 weeks left' },
  soon: { bg: '#fef3c7', color: '#92400e', label: '2–4 weeks left' },
  ok: { bg: '#ecfdf5', color: '#166534', label: 'Healthy' },
  over: { bg: '#f1f5f9', color: '#475569', label: `Over ${OVERSTOCK_DAYS / 30} months of stock` },
  idle: { bg: '#f8fafc', color: '#94a3b8', label: 'In stock, no sales in 30 days' },
  dead: { bg: '#f8fafc', color: '#cbd5e1', label: 'Out, not selling' },
};
const ABC_STYLE = { A: { bg: '#dbeafe', color: '#1d4ed8' }, B: { bg: '#f1f5f9', color: '#334155' }, C: { bg: '#f8fafc', color: '#94a3b8' } };
const sizesOf = (p: Product) => [...p.variants].sort((a, b) => sizeRank(a.size) - sizeRank(b.size));

export const InventoryView: React.FC = () => {
  const { data, error, loading, reload } = useApi<Data>('/api/inventory/stock');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('value');
  const [openId, setOpenId] = useState<number | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const products = data?.products || [];
  const counts = useMemo(() => ({
    low: products.filter(p => p.sold30 > 0 && p.stock > 0 && (p.coverDays ?? Infinity) < 30).length,
    sizes: products.filter(p => p.variants.some(v => v.stock === 0 && v.sold30 > 0)).length,
    dead: products.filter(p => p.stock > 0 && p.sold90 === 0).length,
    over: products.filter(p => p.stock > 0 && p.coverDays != null && p.coverDays > OVERSTOCK_DAYS).length,
  }), [products]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = products.filter(p => !needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle) || p.variants.some(v => v.sku.toLowerCase().includes(needle)));
    if (filter === 'low') list = list.filter(p => p.sold30 > 0 && p.stock > 0 && (p.coverDays ?? Infinity) < 30);
    if (filter === 'sizes') list = list.filter(p => p.variants.some(v => v.stock === 0 && v.sold30 > 0));
    if (filter === 'dead') list = list.filter(p => p.stock > 0 && p.sold90 === 0);
    if (filter === 'over') list = list.filter(p => p.stock > 0 && p.coverDays != null && p.coverDays > OVERSTOCK_DAYS);
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      value: (a, b) => b.costValue - a.costValue,
      stock: (a, b) => b.stock - a.stock,
      sold: (a, b) => b.sold30 - a.sold30,
      cover: (a, b) => (a.coverDays ?? 1e9) - (b.coverDays ?? 1e9),
      sellthrough: (a, b) => b.sellThrough30 - a.sellThrough30,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [products, q, filter, sort]);

  if (loading && !data) return <section className="view"><LoadingState label="Loading stock and sales from WooCommerce…" /></section>;
  if (error && !data) return <section className="view"><ErrorState message="Could not load inventory" hint={error} onRetry={() => reload(true)} /></section>;
  if (!data) return null;

  const t = data.totals;
  const skus = products.reduce((n, p) => n + Math.max(1, p.variants.length), 0);
  const soldOutSkus = products.reduce((n, p) => n + p.variants.filter(v => v.stock === 0 && v.sold30 > 0).length, 0);
  const storeSellThrough = t.sold30 + t.units ? (t.sold30 / (t.sold30 + t.units)) * 100 : 0;
  const open = products.find(p => p.id === openId) || null;

  const exportCsv = () => {
    const lines = [['Product', 'Size', 'SKU', 'In stock', 'Counted', 'Sold 30d', 'Unit cost', 'Value at cost']];
    for (const p of rows) {
      const vs = p.variants.length ? sizesOf(p) : [{ size: '—', sku: p.sku, stock: p.stock, sold30: p.sold30 } as Variant];
      for (const v of vs) lines.push([p.name, v.size, v.sku, String(v.stock), '', String(v.sold30), String(Math.round(p.unitCost)), String(Math.round(v.stock * p.unitCost))]);
    }
    const csv = lines.map(r => r.map(c => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `stock-count-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const chip = (id: Filter, label: string, n?: number) => (
    <button key={id} type="button" onClick={() => setFilter(id)}
      style={{ border: '1px solid #e2e7ee', borderRadius: 99, padding: '5px 11px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        background: filter === id ? '#0f172a' : '#fff', color: filter === id ? '#fff' : '#334155' }}>
      {label}{n != null && <span style={{ opacity: 0.6, marginLeft: 5 }}>{n}</span>}
    </button>
  );

  return (
    <section className="view" id="inventory-view" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="fin-kpi-grid inv-kpis">
        <KpiCard label="Units on hand" icon={Boxes} value={t.units.toLocaleString()} sub={`${products.length} products · ${skus} sizes/SKUs`} />
        <KpiCard label="Stock value" icon={Wallet} value={fmt(t.costValue)} sub={`at cost · ${fmtCompact(t.retailValue)} at selling price`} />
        <KpiCard label="Sell-through (30 days)" icon={Gauge} value={`${storeSellThrough.toFixed(1)}%`}
          tone={storeSellThrough >= 25 ? 'good' : storeSellThrough >= 12 ? 'warn' : 'bad'}
          sub={`${t.sold30} sold of ${(t.sold30 + t.units).toLocaleString()} available`} />
        <KpiCard label="Stock lasts" icon={Timer} value={t.coverDays ? `${Math.round(t.coverDays)} days` : '—'} sub="at the last 30 days’ pace" />
        <KpiCard label="Sold-out sizes" icon={AlertTriangle} value={String(soldOutSkus)} tone={soldOutSkus ? 'bad' : 'good'}
          sub={soldOutSkus ? 'still selling — lost sales' : 'none on selling products'} onClick={soldOutSkus ? () => setFilter('sizes') : undefined} />
        <KpiCard label="Not selling (90 days)" icon={PackageX} value={fmt(t.deadValue)} tone={t.deadValue ? 'warn' : undefined}
          sub={`${t.deadUnits} units tied up`} onClick={t.deadUnits ? () => setFilter('dead') : undefined} />
      </div>

      <div className="fin-grid-main">
        <SizeCurve products={products} />
        <AbcCard products={products} />
      </div>

      <Card padding="14px 16px">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <label style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product or SKU" aria-label="Search products"
              style={{ width: '100%', border: '1px solid #d9dee6', borderRadius: 8, padding: '7px 10px 7px 30px', fontSize: '0.82rem' }} />
          </label>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', maxWidth: '100%' }}>
            {chip('all', 'All', products.length)}
            {chip('sizes', 'Sold-out sizes', counts.sizes)}
            {chip('low', 'Running low', counts.low)}
            {chip('over', 'Overstocked', counts.over)}
            {chip('dead', 'Not selling', counts.dead)}
          </div>
          <span style={{ flex: 1 }} />
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort"
            style={{ border: '1px solid #d9dee6', borderRadius: 8, padding: '6px 8px', fontSize: '0.8rem', background: '#fff' }}>
            <option value="value">Sort: stock value</option><option value="stock">Sort: units</option><option value="sold">Sort: best sellers</option>
            <option value="sellthrough">Sort: sell-through</option><option value="cover">Sort: runs out first</option><option value="name">Sort: name</option>
          </select>
          <button type="button" onClick={exportCsv} title="Download a stock-count sheet (CSV) for the current list"
            style={{ border: '1px solid #d9dee6', background: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <Download size={13} /> Count sheet
          </button>
          <button type="button" onClick={() => reload(true)} disabled={loading} aria-label="Refresh from WooCommerce"
            style={{ border: '1px solid #d9dee6', background: '#fff', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', display: 'inline-flex' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: '0.7rem', color: '#64748b', marginBottom: 10 }}>
          {(['out', 'low', 'soon', 'ok', 'over', 'idle'] as const).map(k => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: TONE[k].bg, border: `1px solid ${TONE[k].color}33` }} />{TONE[k].label}
            </span>
          ))}
        </div>

        <div className="fin-table-scroll">
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Product</th><th style={th}>Stock by size</th><th style={{ ...th, ...num }}>Units</th>
                <th style={{ ...th, ...num }}>Sold 30d</th><th style={th}>13 weeks</th><th style={{ ...th, ...num }}>Sell-through</th>
                <th style={{ ...th, ...num }}>Lasts</th><th style={{ ...th, ...num }}>Value at cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="fin-row" onClick={() => setOpenId(p.id)} style={{ cursor: 'pointer' }}>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Thumb src={p.image} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', gap: 6, alignItems: 'center' }}>
                          <b title="A = top 80% of 90-day sales, B = next 15%, C = the rest" style={{ fontSize: '0.64rem', padding: '0 5px', borderRadius: 4, background: ABC_STYLE[p.abc].bg, color: ABC_STYLE[p.abc].color }}>{p.abc}</b>
                          {fmt(p.price)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {sizesOf(p).map(v => {
                        const tone = TONE[coverTone(v.coverDays, v.stock, v.sold30)];
                        return (
                          <div key={v.id} title={`${v.size}: ${v.stock} in stock · ${v.sold30} sold in 30 days · ${coverText(v.coverDays, v.stock)}`}
                            style={{ minWidth: 38, textAlign: 'center', padding: '3px 4px', borderRadius: 6, background: tone.bg, color: tone.color }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, opacity: 0.8 }}>{v.size}</div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{v.stock}</div>
                          </div>
                        );
                      })}
                      {!p.variants.length && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>One size</span>}
                    </div>
                  </td>
                  <td style={{ ...td, ...num, fontWeight: 700 }}>{p.stock}</td>
                  <td style={{ ...td, ...num }}>{p.sold30 || <b style={{ color: '#cbd5e1', fontWeight: 400 }}>0</b>}</td>
                  <td style={{ ...td, width: 90 }}><div style={{ width: 80 }}><Sparkline data={p.weekly} color={CHART.revenue} height={24} /></div></td>
                  <td style={{ ...td, ...num }}>{p.sold30 ? `${Math.round(p.sellThrough30 * 100)}%` : '—'}</td>
                  <td style={{ ...td, ...num, fontWeight: 700, color: TONE[coverTone(p.coverDays, p.stock, p.sold30)].color }}>{coverText(p.coverDays, p.stock)}</td>
                  <td style={{ ...td, ...num }}>{fmt(p.costValue)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 30 }}>No products match.</td></tr>}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
          Live from WooCommerce, updated {new Date(data.asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Sales are orders placed (cancelled excluded). Click a product to adjust stock.
        </p>
      </Card>

      <Adjustments list={data.adjustments} />

      {open && (
        <ProductPanel product={open} onClose={() => setOpenId(null)}
          onSaved={(msg) => { push({ text: msg }); reload(true); }}
          onError={(msg) => push({ text: msg, tone: 'error' })} />
      )}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </section>
  );
};

const Thumb = ({ src, size }: { src: string | null; size: number }) => (
  src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" loading="lazy" style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#f1f5f9' }} />
    : <div style={{ width: size, height: size, borderRadius: 8, background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Boxes size={size / 2.5} color="#cbd5e1" /></div>
);

/** Share of sales vs share of stock by size — tells you the ratio to cut the next batch in. */
const SizeCurve = ({ products }: { products: Product[] }) => {
  const agg = new Map<string, { sold: number; stock: number }>();
  for (const p of products) for (const v of p.variants) {
    const k = v.size.toUpperCase();
    const a = agg.get(k) || { sold: 0, stock: 0 };
    a.sold += v.sold90; a.stock += v.stock;
    agg.set(k, a);
  }
  const sizes = [...agg.entries()].filter(([, a]) => a.sold + a.stock > 0).sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]));
  const totSold = sizes.reduce((t, [, a]) => t + a.sold, 0) || 1;
  const totStock = sizes.reduce((t, [, a]) => t + a.stock, 0) || 1;
  const rows = sizes.map(([size, a]) => ({ size, sold: (a.sold / totSold) * 100, stock: (a.stock / totStock) * 100 }));
  const max = Math.max(1, ...rows.flatMap(r => [r.sold, r.stock]));
  const under = rows.filter(r => r.sold - r.stock >= 4).sort((a, b) => (b.sold - b.stock) - (a.sold - a.stock));
  const over = rows.filter(r => r.stock - r.sold >= 4).sort((a, b) => (b.stock - b.sold) - (a.stock - a.sold));
  const ratio = rows.map(r => `${r.size} ${Math.round(r.sold)}%`).join(' · ');

  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Ruler size={15} /> Size curve</span>}
      subtitle="What share of sales each size gets (last 90 days) vs its share of your stock">
      {rows.length === 0 ? <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No sized products.</p> : (
        <>
          <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', color: '#475569', marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: CHART.revenue }} />Share of sales</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#cbd5e1' }} />Share of stock</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {rows.map(r => (
              <div key={r.size} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 92px', gap: 10, alignItems: 'center' }}>
                <b style={{ fontSize: '0.82rem' }}>{r.size}</b>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ height: 9, width: `${(r.sold / max) * 100}%`, background: CHART.revenue, borderRadius: 3, minWidth: 2 }} />
                  <div style={{ height: 9, width: `${(r.stock / max) * 100}%`, background: '#cbd5e1', borderRadius: 3, minWidth: 2 }} />
                </div>
                <span style={{ fontSize: '0.74rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#334155' }}>
                  {Math.round(r.sold)}% <span style={{ color: '#94a3b8' }}>vs {Math.round(r.stock)}%</span>
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 9, fontSize: '0.78rem', color: '#334155', lineHeight: 1.55 }}>
            {under.length > 0 && <div>Make more <b>{under.map(r => r.size).join(', ')}</b>: {under.map(r => `${r.size} is ${Math.round(r.sold)}% of sales but ${Math.round(r.stock)}% of stock`).join('; ')}.</div>}
            {over.length > 0 && <div>Make less <b>{over.map(r => r.size).join(', ')}</b> — more stock than sales justify.</div>}
            {!under.length && !over.length && <div>Stock is well matched to what sells.</div>}
            <div style={{ marginTop: 4, color: '#64748b' }}>Suggested size split for the next batch: <b style={{ color: '#0f172a' }}>{ratio}</b></div>
          </div>
        </>
      )}
    </Card>
  );
};

const AbcCard = ({ products }: { products: Product[] }) => {
  const classes = (['A', 'B', 'C'] as const).map(k => {
    const ps = products.filter(p => p.abc === k);
    return { k, count: ps.length, revenue: ps.reduce((t, p) => t + p.revenue90, 0), value: ps.reduce((t, p) => t + p.costValue, 0) };
  });
  const totRev = classes.reduce((t, c) => t + c.revenue, 0) || 1;
  const totVal = classes.reduce((t, c) => t + c.value, 0) || 1;
  const hint = { A: 'Never let these run out', B: 'Restock on demand', C: 'Discount, bundle or stop remaking' };
  return (
    <Card title="Where your stock money sits" subtitle="Products ranked by 90-day sales (ABC)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {classes.map(c => (
          <div key={c.k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.8rem', marginBottom: 4 }}>
              <span><b style={{ padding: '1px 6px', borderRadius: 4, background: ABC_STYLE[c.k].bg, color: ABC_STYLE[c.k].color, marginRight: 6 }}>{c.k}</b>{c.count} products</span>
              <span style={{ color: '#64748b', fontSize: '0.74rem' }}>{Math.round((c.revenue / totRev) * 100)}% of sales · {Math.round((c.value / totVal) * 100)}% of stock value</span>
            </div>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(c.value / totVal) * 100}%`, background: c.k === 'A' ? CHART.revenue : c.k === 'B' ? '#94a3b8' : '#cbd5e1' }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 3 }}>{fmt(c.value)} at cost · {hint[c.k]}</div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const Adjustments = ({ list }: { list: Adjustment[] }) => (
  <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><History size={15} /> Stock changes</span>} subtitle="Every adjustment made here, who made it and why">
    {list.length === 0 ? (
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No adjustments yet. Click a product to record new stock, a count, or damage.</p>
    ) : (
      <div className="fin-table-scroll" style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>When</th><th style={th}>Product</th><th style={{ ...th, ...num }}>Change</th><th style={th}>Reason</th><th style={th}>By</th></tr></thead>
          <tbody>
            {list.map(a => {
              const d = a.after_qty - a.before_qty;
              return (
                <tr key={a.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={td}>{a.product_name}{a.size && <b style={{ fontWeight: 400, color: '#94a3b8' }}> · {a.size}</b>}</td>
                  <td style={{ ...td, ...num, fontWeight: 700, color: d >= 0 ? '#15803d' : '#b91c1c' }}>{d >= 0 ? '+' : ''}{d} <b style={{ fontWeight: 400, color: '#94a3b8' }}>({a.before_qty}→{a.after_qty})</b></td>
                  <td style={td}>{REASONS.find(r => r.id === a.reason)?.label || a.reason}{a.note && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{a.note}</div>}</td>
                  <td style={td}>{a.created_by || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

/** Side panel: per-size detail, weekly sales and stock adjustment. */
const ProductPanel = ({ product: p, onClose, onSaved, onError }: { product: Product; onClose: () => void; onSaved: (m: string) => void; onError: (m: string) => void }) => {
  const sizes = sizesOf(p);
  const [variantId, setVariantId] = useState<number | null>(sizes[0]?.id ?? null);
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { setReason(mode === 'set' ? 'count' : 'restock'); }, [mode]);

  const v = sizes.find(x => x.id === variantId) || null;
  const current = v ? v.stock : p.stock;
  const n = qty === '' ? NaN : Number(qty);
  const valid = Number.isInteger(n) && (mode === 'set' ? n >= 0 : n !== 0 && current + n >= 0);
  const margin = p.price - p.unitCost;
  const maxW = Math.max(1, ...p.weekly);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const r = await fetch('/api/inventory/stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: p.id, variation_id: v?.id ?? null, quantity: n, mode, reason, note, product_name: p.name, size: v?.size }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Could not save');
      onSaved(`${p.name}${v ? ` ${v.size}` : ''}: ${j.before} → ${j.after}${j.logged ? '' : ' (saved, but not logged)'}`);
      setQty(''); setNote('');
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={p.name} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(480px, 100%)', height: '100%', background: '#fff', overflowY: 'auto', padding: 'calc(18px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))', boxShadow: '-12px 0 40px rgba(15,23,42,0.18)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <Thumb src={p.image} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>{p.name}</div>
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 3 }}>{p.sku || 'No SKU'} · class {p.abc}</div>
            <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: 4 }}>
              {fmt(p.price)} price · {fmt(p.unitCost)} cost{!p.specificCost && ' (default)'} · <b style={{ color: margin >= 0 ? '#15803d' : '#b91c1c' }}>{fmt(margin)} margin/unit</b>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[['On hand', String(p.stock)], ['Sold 30d', String(p.sold30)], ['Lasts', coverText(p.coverDays, p.stock)]].map(([l, val]) => (
            <div key={l} style={{ background: '#f8fafc', borderRadius: 9, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{l}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Units sold per week (13 weeks)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, marginBottom: 16 }}>
          {p.weekly.map((w, i) => (
            <div key={i} title={`${w} sold, ${12 - i === 0 ? 'this week' : `${12 - i} week${12 - i > 1 ? 's' : ''} ago`}`}
              style={{ flex: 1, height: `${Math.max(2, (w / maxW) * 56)}px`, background: w ? CHART.revenue : '#e2e8f0', borderRadius: 3 }} />
          ))}
        </div>

        {sizes.length > 0 && (
          <table style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', marginBottom: 18 }}>
            <thead><tr><th style={th}>Size</th><th style={{ ...th, ...num }}>Stock</th><th style={{ ...th, ...num }}>Sold 30d</th><th style={{ ...th, ...num }}>90d</th><th style={{ ...th, ...num }}>Lasts</th></tr></thead>
            <tbody>
              {sizes.map(x => {
                const tone = TONE[coverTone(x.coverDays, x.stock, x.sold30)];
                return (
                  <tr key={x.id} onClick={() => setVariantId(x.id)} style={{ cursor: 'pointer', background: x.id === variantId ? '#eff6ff' : undefined }}>
                    <td style={{ ...td, fontWeight: 800 }}>{x.size}</td>
                    <td style={{ ...td, ...num, fontWeight: 700 }}>{x.stock}</td>
                    <td style={{ ...td, ...num }}>{x.sold30}</td>
                    <td style={{ ...td, ...num, color: '#64748b' }}>{x.sold90}</td>
                    <td style={{ ...td, ...num }}><b style={{ padding: '2px 7px', borderRadius: 5, background: tone.bg, color: tone.color, fontSize: '0.72rem' }}>{coverText(x.coverDays, x.stock)}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ border: '1px solid #e2e7ee', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardCheck size={15} /> Adjust stock</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([['add', 'Add / remove'], ['set', 'Set exact count']] as const).map(([m, l]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{ flex: 1, border: '1px solid #e2e7ee', borderRadius: 8, padding: '7px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', background: mode === m ? '#0f172a' : '#fff', color: mode === m ? '#fff' : '#334155' }}>{l}</button>
            ))}
          </div>
          {sizes.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {sizes.map(x => (
                <button key={x.id} type="button" onClick={() => setVariantId(x.id)}
                  style={{ border: '1px solid #e2e7ee', borderRadius: 7, padding: '5px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', background: x.id === variantId ? '#2a78d6' : '#fff', color: x.id === variantId ? '#fff' : '#334155' }}>
                  {x.size} <span style={{ opacity: 0.7, fontWeight: 500 }}>{x.stock}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
            {mode === 'add' && <button type="button" aria-label="Minus one" onClick={() => setQty(String((Number(qty) || 0) - 1))} style={stepBtn}><Minus size={14} /></button>}
            <input type="number" inputMode="numeric" value={qty} onChange={e => setQty(e.target.value)} placeholder={mode === 'add' ? 'e.g. 20 or -2' : 'Counted units'}
              style={{ flex: 1, border: '1px solid #d9dee6', borderRadius: 8, padding: '8px 10px', fontSize: '0.9rem', minWidth: 0 }} />
            {mode === 'add' && <button type="button" aria-label="Plus one" onClick={() => setQty(String((Number(qty) || 0) + 1))} style={stepBtn}><Plus size={14} /></button>}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: 10 }}>
            {v ? `${v.size}: ` : ''}{current} now{Number.isInteger(n) && valid && <> → <b style={{ color: '#0f172a' }}>{mode === 'set' ? n : current + n}</b></>}
            {Number.isInteger(n) && mode === 'add' && current + n < 0 && <b style={{ color: '#b91c1c' }}> · only {current} in stock</b>}
          </div>
          <select value={reason} onChange={e => setReason(e.target.value)} aria-label="Reason"
            style={{ width: '100%', border: '1px solid #d9dee6', borderRadius: 8, padding: '8px', fontSize: '0.82rem', marginBottom: 8, background: '#fff' }}>
            {REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional) — e.g. batch #12 from factory" maxLength={300}
            style={{ width: '100%', border: '1px solid #d9dee6', borderRadius: 8, padding: '8px 10px', fontSize: '0.82rem', marginBottom: 10 }} />
          <button type="button" disabled={!valid || busy} onClick={submit}
            style={{ width: '100%', border: 'none', borderRadius: 9, padding: '10px', fontWeight: 800, fontSize: '0.86rem', cursor: valid && !busy ? 'pointer' : 'default', background: valid ? '#0f172a' : '#cbd5e1', color: '#fff' }}>
            {busy ? 'Saving to WooCommerce…' : 'Save stock'}
          </button>
          <p style={{ margin: '8px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>Updates the live stock on your website and records the change below.</p>
        </div>
      </div>
    </div>
  );
};

const stepBtn: React.CSSProperties = { border: '1px solid #d9dee6', background: '#fff', borderRadius: 8, width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
