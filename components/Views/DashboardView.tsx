'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingBag, TrendingUp, Receipt, Truck, RotateCcw, Megaphone, RefreshCw,
  AlertTriangle, CheckCircle2, Info, PackageCheck, Wallet,
} from 'lucide-react';
import { PeriodProvider, PeriodBar, GranularityToggle, usePeriod } from '@/components/Finance/period';
import { Card, KpiCard, Segmented, ErrorState, EmptyState, pctChange } from '@/components/Finance/ui';
import { fmt, fmtCompact, CHART } from '@/components/Finance/shared';
import { StockAlerts } from '@/components/Dashboard/StockAlerts';
import { bucketsInRange, bucketKeyFor } from '@/lib/finance/periods';
import { ORDER_STATUSES, STATUS_LABEL, STATUS_STYLE } from '@/lib/orderStatus';
import type { OrderStatus } from '@/lib/types/commerce';

// ─── data ─────────────────────────────────────────────────────────────────────

type Sales = { revenue: number; orders: number; aov: number; cancelled: number };
type Day = { date: string; revenue: number; orders: number };
type Courier = {
  delivered: { count: number; amount: number };
  inTransit: { count: number; amount: number };
  returned: { count: number; amount: number };
  returnRate: number | null;
};

interface DashboardData {
  range: { from: string; to: string };
  compare: { from: string; to: string } | null;
  sales: Sales;
  prevSales: Sales | null;
  daily: Day[];
  prevDaily: Day[] | null;
  pipeline: Record<OrderStatus, number>;
  courier: Courier | null;
  prevCourier: Courier | null;
  adSpend: number | null;
  prevAdSpend: number | null;
  topProducts: { name: string; units: number; revenue: number; orders: number }[];
  payouts: {
    paidInPeriod: number;
    payoutCount: number;
    inReview: number;
    preparing: number;
    inProcess: number;
    lastPayout: { amount: number; date: string; method: string } | null;
    lifetime: number | null;
  };
  errors: Record<'orders' | 'courier' | 'ads' | 'payouts', string | null>;
}

type StockItem = { sku: string; product: string; current: number; reorderPoint: number };

function useDashboard() {
  const p = usePeriod();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from: p.range.from, to: p.range.to });
    if (p.compareRange) {
      params.set('cfrom', p.compareRange.from);
      params.set('cto', p.compareRange.to);
    }
    if (refresh) params.set('refresh', 'true');
    try {
      const res = await fetch(`/api/dashboard/metrics?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `Request failed (${res.status})`);
      // Ignore responses for a period the user has already moved away from
      if (id === reqId.current) setData(json);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [p.range.from, p.range.to, p.compareRange?.from, p.compareRange?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

function useStock() {
  const [items, setItems] = useState<StockItem[] | null>(null);
  const load = useCallback(() => {
    fetch('/api/inventory')
      .then((r) => r.json())
      .then((j) => setItems(j.lowStock ?? []))
      .catch(() => setItems([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { items, reload: load };
}

// ─── chart ────────────────────────────────────────────────────────────────────

const axisProps = { tick: { fontSize: 11, fill: CHART.axis }, axisLine: false, tickLine: false } as const;

const SalesTooltip = ({ active, payload, label, metric }: any) => {
  if (!active || !payload?.length) return null;
  const show = (v: number) => (metric === 'revenue' ? fmt(v) : `${v.toLocaleString()} orders`);
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '9px 12px', fontSize: '0.76rem', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', minWidth: 170 }}>
      <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{label}</div>
      {payload.filter((x: any) => x.value != null).map((x: any) => (
        <div key={x.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3, color: '#334155' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: x.color || x.stroke || x.fill }} />
            {x.name}
          </span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>{show(Number(x.value))}</span>
        </div>
      ))}
    </div>
  );
};

function SalesChart({ data }: { data: DashboardData }) {
  const p = usePeriod();
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');

  // Bucket daily rows to the chosen granularity; the comparison period is aligned by position
  const series = useMemo(() => {
    const unit = p.chartGranularity;
    const buckets = bucketsInRange(data.range.from, data.range.to, unit);
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    const rows = buckets.map((b) => ({ label: b.label, value: 0, prev: data.prevDaily ? 0 : null as number | null }));
    for (const d of data.daily) {
      const i = index.get(bucketKeyFor(d.date, unit));
      if (i != null) rows[i].value += d[metric];
    }
    if (data.prevDaily && data.compare) {
      const prevBuckets = bucketsInRange(data.compare.from, data.compare.to, unit);
      const prevIndex = new Map(prevBuckets.map((b, i) => [b.key, i]));
      for (const d of data.prevDaily) {
        const i = prevIndex.get(bucketKeyFor(d.date, unit));
        if (i != null && i < rows.length) rows[i].prev = (rows[i].prev ?? 0) + d[metric];
      }
    }
    return rows;
  }, [data, metric, p.chartGranularity]);

  const hasData = series.some((r) => r.value > 0 || (r.prev ?? 0) > 0);
  const label = metric === 'revenue' ? 'Sales' : 'Orders';

  return (
    <Card
      title={metric === 'revenue' ? 'Sales' : 'Orders placed'}
      subtitle={`${p.label}${data.compare ? ` · line shows ${p.compareText}` : ''}`}
      action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Segmented size="sm" value={metric} onChange={setMetric} options={[{ id: 'revenue', label: 'Sales ৳' }, { id: 'orders', label: 'Orders' }]} />
          <GranularityToggle />
        </div>
      }
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={series} barCategoryGap={series.length > 20 ? '18%' : '28%'} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} minTickGap={12} />
            <YAxis {...axisProps} width={56} allowDecimals={false} tickFormatter={metric === 'revenue' ? fmtCompact : (v: number) => String(v)} />
            <Tooltip content={<SalesTooltip metric={metric} />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
            <Bar dataKey="value" name={label} fill={CHART.revenue} radius={[4, 4, 0, 0]} maxBarSize={36} />
            {data.prevDaily && (
              <Line dataKey="prev" name={`${label} · comparison`} stroke={CHART.compare} strokeWidth={2} strokeDasharray="4 4" dot={false} type="linear" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState bare title="No orders in this period" hint="Try a longer range from the period bar." />
      )}
    </Card>
  );
}

// ─── panels ───────────────────────────────────────────────────────────────────

const ROW_LABEL: React.CSSProperties = { fontSize: '0.8rem', color: '#334155' };
const ROW_VALUE: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' };

/** Labelled horizontal bar, as used by Finance's cost mix and order health. */
const BarRow = ({ label, value, share, color, right }: { label: React.ReactNode; value: React.ReactNode; share: number; color: string; right?: React.ReactNode }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
      <span style={ROW_LABEL}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>{right}<span style={ROW_VALUE}>{value}</span></span>
    </div>
    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 400ms ease' }} />
    </div>
  </div>
);

function FulfilmentCard({ data, onOpenOrders }: { data: DashboardData; onOpenOrders?: () => void }) {
  const total = ORDER_STATUSES.reduce((s, k) => s + data.pipeline[k], 0);
  return (
    <Card
      title="Fulfilment"
      subtitle="Orders placed in this period, by current status"
      action={onOpenOrders && <button type="button" onClick={onOpenOrders} style={linkBtn}>Orders →</button>}
    >
      {total === 0 ? <EmptyState bare title="No orders in this period" /> : ORDER_STATUSES.map((k) => (
        <BarRow key={k} label={STATUS_LABEL[k]} value={data.pipeline[k].toLocaleString()} share={data.pipeline[k] / total} color={STATUS_STYLE[k].accent} />
      ))}
    </Card>
  );
}

function CourierCard({ data }: { data: DashboardData }) {
  const c = data.courier;
  if (!c) {
    return <Card title="Courier"><ErrorState bare message="Pathao data unavailable" hint={data.errors.courier ?? undefined} /></Card>;
  }
  const total = c.delivered.count + c.inTransit.count + c.returned.count;
  const rows = [
    { label: 'Delivered', ...c.delivered, color: '#16a34a' },
    { label: 'In transit', ...c.inTransit, color: '#2563eb' },
    { label: 'Returned', ...c.returned, color: '#dc2626' },
  ];
  return (
    <Card title="Courier" subtitle="Pathao parcels booked in this period">
      {total === 0 ? <EmptyState bare title="No Pathao parcels in this period" /> : rows.map((r) => (
        <BarRow key={r.label}
          label={<><b style={{ color: '#0f172a' }}>{r.count.toLocaleString()}</b> {r.label.toLowerCase()}</>}
          value={fmt(r.amount)} share={r.count / total} color={r.color} />
      ))}
      {c.returnRate != null && (
        <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', ...ROW_LABEL }}>
          <span>Return rate (of closed parcels)</span>
          <span style={{ ...ROW_VALUE, color: c.returnRate >= 25 ? '#b91c1c' : c.returnRate >= 15 ? '#b45309' : '#15803d' }}>{c.returnRate.toFixed(1)}%</span>
        </div>
      )}
    </Card>
  );
}

function PayoutsCard({ data }: { data: DashboardData }) {
  const p = data.payouts;
  const pending = p.inReview + p.preparing + p.inProcess;
  if (data.errors.payouts && !p.lastPayout) {
    return <Card title="Pathao payouts"><ErrorState bare message="Pathao payouts unavailable" hint={data.errors.payouts} /></Card>;
  }
  const line = (label: string, value: number) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={ROW_LABEL}>{label}</span><span style={ROW_VALUE}>{fmt(value)}</span>
    </div>
  );
  return (
    <Card title="Pathao payouts" subtitle="Cash from delivered COD orders">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ background: '#f0fdf4', borderRadius: 9, padding: '10px 12px' }}>
          <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid in period</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{fmt(p.paidInPeriod)}</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.payoutCount} payout{p.payoutCount === 1 ? '' : 's'}</div>
        </div>
        <div style={{ background: '#fffbeb', borderRadius: 9, padding: '10px 12px' }}>
          <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending now</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{fmt(pending)}</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Held by Pathao</div>
        </div>
      </div>
      {line('In review', p.inReview)}
      {line('Preparing invoice', p.preparing)}
      {line('In process', p.inProcess)}
      {p.lastPayout && (
        <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid #f1f5f9', fontSize: '0.72rem', color: '#64748b' }}>
          Last payout {fmt(p.lastPayout.amount)} on {p.lastPayout.date} via {p.lastPayout.method}
          {p.lifetime != null && <> · lifetime {fmtCompact(p.lifetime)}</>}
        </div>
      )}
    </Card>
  );
}

function TopProductsCard({ data }: { data: DashboardData }) {
  const max = data.topProducts[0]?.revenue || 1;
  const totalRevenue = data.sales.revenue || 1;
  return (
    <Card title="Top products" subtitle="By sales in this period, all sizes combined">
      {data.topProducts.length === 0 ? <EmptyState bare title="No product sales in this period" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 54px 84px', gap: 10, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #f1f5f9', fontSize: '0.64rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Product</span><span style={{ textAlign: 'right' }}>Units</span><span style={{ textAlign: 'right' }}>Sales</span>
          </div>
          {data.topProducts.map((p) => (
            <div key={p.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 54px 84px', gap: 10, alignItems: 'center', padding: '6px 0' }}>
              <div style={{ minWidth: 0 }}>
                <div title={p.name} style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(p.revenue / max) * 100}%`, height: '100%', background: CHART.revenue, borderRadius: 99 }} />
                </div>
              </div>
              <span style={{ ...ROW_VALUE, textAlign: 'right', fontWeight: 600 }}>{p.units}</span>
              <span style={{ ...ROW_VALUE, textAlign: 'right' }} title={`${((p.revenue / totalRevenue) * 100).toFixed(1)}% of sales`}>{fmt(p.revenue)}</span>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

type Note = { tone: 'good' | 'warn' | 'bad' | 'info'; text: React.ReactNode };
const NOTE_STYLE = {
  good: { bg: '#f0fdf4', icon: CheckCircle2, color: '#15803d' },
  warn: { bg: '#fffbeb', icon: AlertTriangle, color: '#b45309' },
  bad: { bg: '#fef2f2', icon: AlertTriangle, color: '#b91c1c' },
  info: { bg: '#f8fafc', icon: Info, color: '#475569' },
} as const;

function AttentionCard({ data, stock, compareText }: { data: DashboardData; stock: StockItem[] | null; compareText: string }) {
  const notes: Note[] = [];
  const waiting = data.pipeline.paid + data.pipeline.packed + data.pipeline.hold;
  if (waiting > 0) notes.push({ tone: 'warn', text: <><b>{waiting}</b> order{waiting === 1 ? '' : 's'} from this period still waiting to dispatch ({data.pipeline.paid} processing, {data.pipeline.packed} packed, {data.pipeline.hold} on hold).</> });
  const critical = stock?.filter((s) => s.current <= 1).length ?? 0;
  if (critical > 0) notes.push({ tone: 'bad', text: <><b>{critical}</b> variant{critical === 1 ? '' : 's'} down to 1 or 0 units — restock before ads drive orders you can't fill.</> });
  const rr = data.courier?.returnRate;
  if (rr != null && rr >= 20) notes.push({ tone: rr >= 25 ? 'bad' : 'warn', text: <>Return rate is <b>{rr.toFixed(1)}%</b> — each return costs delivery both ways.</> });
  const d = pctChange(data.sales.revenue, data.prevSales?.revenue);
  if (d != null && Math.abs(d) >= 10) notes.push({ tone: d > 0 ? 'good' : 'warn', text: <>Sales are <b>{d > 0 ? 'up' : 'down'} {Math.abs(d).toFixed(0)}%</b> {compareText} ({fmt(data.prevSales!.revenue)} → {fmt(data.sales.revenue)}).</> });
  if (data.adSpend && data.sales.revenue) {
    const mer = data.sales.revenue / data.adSpend;
    if (mer < 2.5) notes.push({ tone: 'bad', text: <>Every ৳1 of Meta ads brought <b>৳{mer.toFixed(1)}</b> in sales — below the ৳2.5 comfort line.</> });
  }
  if (data.sales.cancelled > 0 && data.sales.orders > 0) {
    const share = (data.sales.cancelled / (data.sales.orders + data.sales.cancelled)) * 100;
    if (share >= 15) notes.push({ tone: 'warn', text: <><b>{share.toFixed(0)}%</b> of orders placed this period were cancelled or failed ({data.sales.cancelled}).</> });
  }
  if (notes.length === 0) notes.push({ tone: 'good', text: <>Nothing needs attention for this period.</> });

  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} color="#b45309" /> Needs attention</span>}
      subtitle="Generated from this period's numbers">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.slice(0, 5).map((n, i) => {
          const s = NOTE_STYLE[n.tone];
          const Icon = s.icon;
          return (
            <div key={i} style={{ display: 'flex', gap: 9, padding: '9px 11px', background: s.bg, borderRadius: 9, fontSize: '0.78rem', lineHeight: 1.45, color: '#1e293b' }}>
              <Icon size={14} color={s.color} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{n.text}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' };

// ─── page ─────────────────────────────────────────────────────────────────────

function DashboardBody({ onOpenOrders }: { onOpenOrders?: () => void }) {
  const p = usePeriod();
  const { data, loading, error, reload } = useDashboard();
  const stock = useStock();

  const refresh = (
    <button type="button" className="secondary-action" onClick={() => { reload(true); stock.reload(); }} disabled={loading}
      title="Reload from WooCommerce, Pathao and Meta"
      style={{ height: 34, minHeight: 34, padding: '0 12px', fontSize: '0.8rem', borderRadius: 8, gap: 6 }}>
      <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  );

  const spark = (key: 'revenue' | 'orders') => data?.daily.map((d) => d[key]);
  const s = data?.sales;
  const ps = data?.prevSales;
  const c = data?.courier;
  const mer = data?.adSpend && s?.revenue ? s.revenue / data.adSpend : null;
  const awaiting = data ? data.pipeline.paid + data.pipeline.packed + data.pipeline.hold : 0;

  return (
    <>
      <PeriodBar right={refresh} />

      {error && !data && <ErrorState message="Could not load the dashboard" hint={error} onRetry={() => reload(true)} />}
      {error && data && (
        <div role="alert" style={{ marginBottom: 12, padding: '9px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8rem' }}>
          Couldn&apos;t refresh — showing the last loaded figures. {error}
        </div>
      )}

      {!data && !error && (
        <div aria-busy="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ height: 118, borderRadius: 12, border: '1px solid #e2e7ee', background: 'linear-gradient(90deg,#fff,#f4f6f9,#fff)', backgroundSize: '200% 100%', animation: 'dash-shimmer 1.2s ease-in-out infinite' }} />
          ))}
          <style>{'@keyframes dash-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }'}</style>
        </div>
      )}

      {data && s && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms ease' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <KpiCard label="Sales" icon={TrendingUp} value={fmt(s.revenue)}
              delta={ps ? pctChange(s.revenue, ps.revenue) : undefined} compareValue={ps ? fmt(ps.revenue) : undefined}
              sub={p.compareRange ? p.compareText : 'Orders placed, excl. cancelled'} spark={spark('revenue')} sparkColor={CHART.revenue} />
            <KpiCard label="Orders" icon={ShoppingBag} value={s.orders.toLocaleString()}
              delta={ps ? pctChange(s.orders, ps.orders) : undefined} compareValue={ps ? ps.orders.toLocaleString() : undefined}
              sub={awaiting > 0 ? `${awaiting} awaiting dispatch` : `${s.cancelled} cancelled`} spark={spark('orders')} sparkColor={CHART.revenue} />
            <KpiCard label="Avg order value" icon={Receipt} value={s.orders ? fmt(s.aov) : '—'}
              delta={ps && ps.orders ? pctChange(s.aov, ps.aov) : undefined} compareValue={ps && ps.orders ? fmt(ps.aov) : undefined} />
            <KpiCard label="Delivered" icon={Truck} value={c ? fmt(c.delivered.amount) : '—'}
              delta={c && data.prevCourier ? pctChange(c.delivered.amount, data.prevCourier.delivered.amount) : undefined}
              sub={c ? `${c.delivered.count} parcels · Pathao` : 'Pathao unavailable'} />
            <KpiCard label="Return rate" icon={RotateCcw}
              value={c?.returnRate != null ? `${c.returnRate.toFixed(1)}%` : '—'}
              tone={c?.returnRate == null ? undefined : c.returnRate >= 25 ? 'bad' : c.returnRate >= 15 ? 'warn' : 'good'}
              delta={c?.returnRate != null && data.prevCourier?.returnRate != null ? c.returnRate - data.prevCourier.returnRate : undefined}
              deltaGoodWhen="down" deltaPoints
              sub={c ? `${c.returned.count} returned of ${c.delivered.count + c.returned.count} closed` : undefined} />
            <KpiCard label="Ad spend" icon={Megaphone} value={data.adSpend != null ? fmt(data.adSpend) : '—'}
              delta={data.adSpend != null && data.prevAdSpend != null ? pctChange(data.adSpend, data.prevAdSpend) : undefined}
              deltaGoodWhen="neutral"
              sub={data.adSpend == null ? 'Meta Ads unavailable' : mer != null ? `${mer.toFixed(1)}× sales per ৳ (MER)` : 'Meta, incl. 15% VAT'} />
          </div>

          {/* Chart + attention */}
          <div className="dash-grid-chart" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
            <SalesChart data={data} />
            <AttentionCard data={data} stock={stock.items} compareText={p.compareText} />
          </div>

          {/* Operations */}
          <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            <FulfilmentCard data={data} onOpenOrders={onOpenOrders} />
            <CourierCard data={data} />
            <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PackageCheck size={14} /> Stock alerts</span>} subtitle="Variants at or below 10 units">
              {stock.items == null ? <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Checking stock…</div> : <StockAlerts alerts={stock.items} maxHeight={260} />}
            </Card>
          </div>

          {/* Products + cash */}
          <div className="dash-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 16 }}>
            <TopProductsCard data={data} />
            <PayoutsCard data={data} />
          </div>

          <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.5 }}>
            <Wallet size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            Sales count WooCommerce orders placed in the period, excluding cancelled, failed and refunded. Delivered and
            return rate come from Pathao parcels booked in the period. Finance shows revenue as cash collected, so the two can differ.
          </p>
        </div>
      )}

      <style>{`
        @media (max-width: 1100px) {
          .dash-grid-chart, .dash-grid-3, .dash-grid-2 { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </>
  );
}

export const DashboardView: React.FC<{ onOpenOrders?: () => void }> = ({ onOpenOrders }) => (
  <section className="view is-active" id="dashboard-view" data-title="Dashboard">
    <PeriodProvider>
      <DashboardBody onOpenOrders={onOpenOrders} />
    </PeriodProvider>
  </section>
);
