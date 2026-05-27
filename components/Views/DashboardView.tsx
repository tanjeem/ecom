'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Panel } from '@/components/Common/Panel';
import { CashMeter } from '@/components/Dashboard/CashMeter';

type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: '📅 Custom' },
];

const PATHAO_CONFIG: { status: string; color: string; showValue: boolean }[] = [
  { status: 'Not Booked',              color: '#68707a', showValue: true  },
  { status: 'Ready',                   color: '#b46a08', showValue: true  },
  { status: 'Pickup Requested',        color: '#6d4ed9', showValue: false },
  { status: 'Assigned for Pickup',     color: '#6d4ed9', showValue: false },
  { status: 'Pickup',                  color: '#2563eb', showValue: false },
  { status: 'Pickup Failed',           color: '#c23a3a', showValue: false },
  { status: 'Pickup Cancelled',        color: '#c23a3a', showValue: false },
  { status: 'At the Sorting HUB',      color: '#6d4ed9', showValue: false },
  { status: 'In Transit',              color: '#2563eb', showValue: false },
  { status: 'Received at Last Mile Hub', color: '#0f766e', showValue: false },
  { status: 'Assigned for Delivery',   color: '#b46a08', showValue: false },
  { status: 'Delivered',               color: '#16864d', showValue: true  },
  { status: 'Partial Delivery',        color: '#16864d', showValue: true  },
  { status: 'Return',                  color: '#c23a3a', showValue: true  },
  { status: 'Delivery Failed',         color: '#c23a3a', showValue: false },
  { status: 'On Hold',                 color: '#c23a3a', showValue: false },
  { status: 'Payment Invoice',         color: '#b46a08', showValue: true  },
  { status: 'Paid Return',             color: '#0f766e', showValue: true  },
  { status: 'Exchange',                color: '#0f766e', showValue: true  },
  { status: 'Return In Transit',       color: '#6d4ed9', showValue: false },
  { status: 'Returned to Merchant',    color: '#c23a3a', showValue: true  },
];

function fmt(n: number) { return 'BDT ' + n.toLocaleString(); }

function PctBadge({ pct, hasPrev }: { pct: number; hasPrev: boolean }) {
  if (!hasPrev) return <small style={{ color: '#999', fontSize: '0.72rem' }}>—</small>;
  const up = pct > 0;
  const color = up ? '#16864d' : pct < 0 ? '#c23a3a' : '#68707a';
  return (
    <small style={{ color, fontWeight: 600, fontSize: '0.72rem' }}>
      {up ? '▲' : pct < 0 ? '▼' : '—'} {Math.abs(pct)}% vs prev
    </small>
  );
}

function KpiCard({ label, value, pct, hasPrev, sub, accent, loading }: {
  label: string; value: string | number; pct: number; hasPrev: boolean;
  sub?: string; accent: string; loading: boolean;
}) {
  return (
    <div className="metric-card" style={{ borderTop: '3px solid ' + accent, position: 'relative' }}>
      {loading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', borderRadius: 8 }} />}
      <div style={{ fontSize: '0.7rem', color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#202124', marginBottom: 4 }}>
        {loading ? <span style={{ color: '#ddd' }}>—</span> : value}
      </div>
      <PctBadge pct={pct} hasPrev={hasPrev} />
      {sub && <div style={{ marginTop: 3, fontSize: '0.72rem', color: '#999' }}>{sub}</div>}
    </div>
  );
}

function PathaoCard({ status, count, value, color, showValue, loading }: {
  status: string; count: number; value: number; color: string; showValue: boolean; loading: boolean;
}) {
  const empty = count === 0;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e4e8ef',
      borderLeft: '4px solid ' + (empty ? '#ddd' : color),
      borderRadius: 8, padding: '12px 14px',
      opacity: empty ? 0.5 : 1, transition: 'opacity 0.2s',
    }}>
      <div style={{ fontSize: '0.67rem', color: empty ? '#aaa' : color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
        {status}
      </div>
      <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#202124', lineHeight: 1.1 }}>
        {loading ? '…' : count}
        <span style={{ fontSize: '0.75rem', color: '#68707a', fontWeight: 400 }}> orders</span>
      </div>
      {showValue && (
        <div style={{ marginTop: 3, fontSize: '0.8rem', fontWeight: empty ? 400 : 600, color: empty ? '#bbb' : '#202124' }}>
          {loading ? '…' : fmt(value)}
        </div>
      )}
    </div>
  );
}

interface DailyPoint { date: string; orders: number; revenue: number }
interface TopProduct  { product: string; orders: number; revenue: number }
interface PathaoMetric{ status: string; count: number; value: number }

interface PathaoRealMetrics {
  orderSummary: {
    delivered:  { count: number; amount: number; pct: number };
    processing: { count: number; amount: number; pct: number };
    returned:   { count: number; amount: number; pct: number; underProcessing: number };
    paidReturn: { count: number; amount: number; pct: number };
    total:      { count: number; amount: number };
  } | null;
  invoiceSummary: {
    lastInvoiceDate: string;
    paymentSent: number;
    paymentMethod: string;
    lifetimeEarning: number;
    paymentInProcess: number;
    paymentInReview: number;
    paymentPreparingForInvoice: number;
  } | null;
}

interface Metrics {
  label: string;
  totalOrders: number; totalOrdersPct: number;
  totalValue: number; totalValuePct: number;
  processingOrders: number; processingOrdersPct: number;
  holdOrders: number; returnedOrders: number;
  avgOrderValue: number; avgOrderValuePct: number;
  pathaoMetrics: PathaoMetric[];
  dailyChart: DailyPoint[];
  topProducts: TopProduct[];
  cashAvailable: number; cashObligations: number; cashSurplus: number;
}

const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const DashboardView: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month');
  const [customAfter, setCustomAfter] = useState('');
  const [customBefore, setCustomBefore] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [data, setData] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathaoData, setPathaoData] = useState<PathaoRealMetrics | null>(null);
  const [pathaoLoading, setPathaoLoading] = useState(true);

  const fetchMetrics = useCallback(async (p: Period, ca?: string, cb?: string) => {
    setIsLoading(true); setError(null);
    try {
      let url = '/api/dashboard/metrics?period=' + p;
      if (p === 'custom' && ca) { url += '&after=' + ca; if (cb) url += '&before=' + cb; }
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setIsLoading(false); }
  }, []);

  const fetchPathaoMetrics = useCallback(async () => {
    setPathaoLoading(true);
    try {
      const res = await fetch('/api/pathao/metrics');
      const json = await res.json();
      setPathaoData(json);
    } catch {
      // silently fail
    } finally { setPathaoLoading(false); }
  }, []);

  useEffect(() => {
    if (period !== 'custom') fetchMetrics(period);
  }, [period, fetchMetrics]);

  useEffect(() => { fetchPathaoMetrics(); }, [fetchPathaoMetrics]);

  const hasPrev = period !== 'all' && period !== 'custom';

  const pathaoLookup: Record<string, PathaoMetric> = {};
  for (const m of data?.pathaoMetrics ?? []) pathaoLookup[m.status] = m;
  // "Ready" in WooCommerce meta = "Ready to Book" in our UI
  if (pathaoLookup['Ready']) pathaoLookup['Ready to Book'] = pathaoLookup['Ready'];

  return (
    <section className="view is-active" id="dashboard-view" data-title="Dashboard">

      {/* ── Date filter bar ── */}
      <div className="module-toolbar" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div className="segmented-control">
          {PERIODS.map(({ key, label }) => (
            <button key={key} className={period === key ? 'is-selected' : ''}
              onClick={() => { setPeriod(key); setShowCustom(key === 'custom'); }} type="button">
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#68707a' }}>
          <span>{isLoading ? 'Loading…' : data?.label}</span>
          <button className="secondary-action" onClick={() => fetchMetrics(period, customAfter, customBefore)}
            type="button" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>↻</button>
        </div>
      </div>

      {/* Custom date range picker */}
      {showCustom && (
        <div style={{
          background: '#fff', border: '1px solid #d9dee6', borderRadius: 8,
          padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.8rem', color: '#68707a', fontWeight: 600 }}>Date Range:</span>
          <input type="date" value={customAfter} onChange={e => setCustomAfter(e.target.value)}
            style={{ border: '1px solid #d9dee6', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem' }} />
          <span style={{ color: '#999' }}>→</span>
          <input type="date" value={customBefore} onChange={e => setCustomBefore(e.target.value)}
            style={{ border: '1px solid #d9dee6', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem' }} />
          <button className="primary-action"
            onClick={() => { if (customAfter) fetchMetrics('custom', customAfter, customBefore); }}
            style={{ padding: '6px 16px', fontSize: '0.85rem' }} type="button">
            Apply
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: '#fef2f2', color: '#c23a3a', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── WooCommerce KPIs ── */}
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#68707a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        WooCommerce
      </div>
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="Total Orders" value={data?.totalOrders ?? 0}
          pct={data?.totalOrdersPct ?? 0} hasPrev={hasPrev} accent="#2563eb" loading={isLoading} />
        <KpiCard label="Total Order Value" value={fmt(data?.totalValue ?? 0)}
          pct={data?.totalValuePct ?? 0} hasPrev={hasPrev} accent="#16864d" loading={isLoading} />
        <KpiCard label="Processing Orders" value={data?.processingOrders ?? 0}
          pct={data?.processingOrdersPct ?? 0} hasPrev={hasPrev} accent="#b46a08" loading={isLoading}
          sub={'Hold: ' + (data?.holdOrders ?? 0) + '  •  Returned: ' + (data?.returnedOrders ?? 0)} />
        <KpiCard label="Avg Order Value" value={fmt(data?.avgOrderValue ?? 0)}
          pct={data?.avgOrderValuePct ?? 0} hasPrev={hasPrev} accent="#6d4ed9" loading={isLoading} />
      </div>

      {/* ── Pathao: All-time ptc_status from WooCommerce ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#68707a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Pathao Courier — All Orders (via webhook status)
        </span>
        <span style={{ fontSize: '0.68rem', color: '#68707a', background: '#f3f4f6', borderRadius: 4, padding: '2px 7px', fontWeight: 500 }}>
          Shows current delivery state of all booked orders
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        {PATHAO_CONFIG.map(({ status, color, showValue }) => (
          <PathaoCard key={status} status={status}
            count={pathaoLookup[status]?.count ?? 0}
            value={pathaoLookup[status]?.value ?? 0}
            color={color} showValue={showValue} loading={isLoading} />
        ))}
      </div>

      {/* ── Pathao Lifetime Summary (from Pathao API — not date-filtered) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#68707a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Pathao Courier — Lifetime Summary
        </span>
        <span style={{ fontSize: '0.68rem', color: '#b46a08', background: '#fffbeb', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
          Lifetime totals · not date-filtered
        </span>
        <button onClick={fetchPathaoMetrics} type="button"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: '#2563eb' }}>
          ↻ Refresh
        </button>
      </div>

      {pathaoData?.orderSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Delivered',        count: pathaoData.orderSummary.delivered.count,  amount: pathaoData.orderSummary.delivered.amount,  pct: pathaoData.orderSummary.delivered.pct,  color: '#16864d', showAmt: true },
            { label: 'Processing',       count: pathaoData.orderSummary.processing.count, amount: pathaoData.orderSummary.processing.amount, pct: pathaoData.orderSummary.processing.pct, color: '#2563eb', showAmt: false },
            { label: 'Returned',         count: pathaoData.orderSummary.returned.count,   amount: pathaoData.orderSummary.returned.amount,   pct: pathaoData.orderSummary.returned.pct,   color: '#c23a3a', showAmt: true },
            { label: 'Paid Return',      count: pathaoData.orderSummary.paidReturn.count, amount: pathaoData.orderSummary.paidReturn.amount, pct: pathaoData.orderSummary.paidReturn.pct, color: '#0f766e', showAmt: true },
            { label: 'Total (Lifetime)', count: pathaoData.orderSummary.total.count,      amount: pathaoData.orderSummary.total.amount,      pct: 100,                                     color: '#6d4ed9', showAmt: true },
          ].map(({ label, count, amount, pct, color, showAmt }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e4e8ef', borderLeft: '4px solid ' + color, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.67rem', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#202124', lineHeight: 1.1 }}>
                {pathaoLoading ? '…' : count}
                <span style={{ fontSize: '0.75rem', color: '#68707a', fontWeight: 400 }}> orders</span>
              </div>
              {showAmt && <div style={{ marginTop: 3, fontSize: '0.8rem', fontWeight: 600, color: '#202124' }}>{pathaoLoading ? '…' : fmt(amount)}</div>}
              <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#999' }}>{pct.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      )}

      {pathaoData?.invoiceSummary && (
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Cash on Delivery (COD) Details — from Pathao
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { label: 'Payment In Review',          value: pathaoData.invoiceSummary.paymentInReview,            color: '#b46a08' },
              { label: 'Preparing for Invoice',       value: pathaoData.invoiceSummary.paymentPreparingForInvoice, color: '#6d4ed9' },
              { label: 'Payment in Process',          value: pathaoData.invoiceSummary.paymentInProcess,           color: '#2563eb' },
              { label: 'Last Payment Sent',           value: pathaoData.invoiceSummary.paymentSent,                color: '#16864d' },
              { label: 'Lifetime Earning',            value: pathaoData.invoiceSummary.lifetimeEarning,            color: '#0f766e' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: '0.68rem', color: '#68707a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{pathaoLoading ? '…' : fmt(value)}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: '0.68rem', color: '#68707a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Last Invoice Date</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#202124' }}>{pathaoData.invoiceSummary.lastInvoiceDate}</div>
              <div style={{ fontSize: '0.78rem', color: '#999', marginTop: 2 }}>via {pathaoData.invoiceSummary.paymentMethod}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Revenue + Orders chart (Shopify style) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Panel title="Revenue Over Time" subtitle="Daily order value" className="panel">
          {data?.dailyChart && data.dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.dailyChart} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#68707a' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#68707a' }} tickLine={false} axisLine={false} tickFormatter={v => 'BDT ' + (v/1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v) => [fmt(Number(v)), 'Revenue']} labelFormatter={(s) => fmtDate(String(s))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e4e8ef', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
              {isLoading ? 'Loading…' : 'No data'}
            </div>
          )}
        </Panel>

        <Panel title="Orders Over Time" subtitle="Daily order count" className="panel">
          {data?.dailyChart && data.dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.dailyChart} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#68707a' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#68707a' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Orders']} labelFormatter={(s) => fmtDate(String(s))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e4e8ef', fontSize: 12 }} />
                <Bar dataKey="orders" fill="#6d4ed9" radius={[4,4,0,0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
              {isLoading ? 'Loading…' : 'No data'}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Top Products ── */}
      <Panel title="Top Products by Revenue" subtitle={'Best sellers in this period'} className="panel" style={{ marginBottom: 24 }}>
        {isLoading ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#bbb' }}>Loading…</div>
        ) : data?.topProducts && data.topProducts.length > 0 ? (
          <div>
            {/* header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '6px 12px',
              fontSize: '0.68rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.06em',
              borderBottom: '1px solid #f0f2f5' }}>
              <span>Product</span><span>Orders</span><span>Revenue</span>
            </div>
            {data.topProducts.map((p, i) => {
              const maxRev = data.topProducts[0]?.revenue || 1;
              const pct = Math.round((p.revenue / maxRev) * 100);
              return (
                <div key={p.product} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12,
                  padding: '10px 12px', borderBottom: i < data.topProducts.length - 1 ? '1px solid #f0f2f5' : 'none',
                  alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#202124', marginBottom: 3 }}>{p.product}</div>
                    <div style={{ height: 4, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: '#2563eb', borderRadius: 4 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#202124', textAlign: 'right' }}>{p.orders}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#202124', textAlign: 'right', minWidth: 100 }}>{fmt(p.revenue)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#bbb' }}>No data</div>
        )}
      </Panel>

      {/* ── Cash Position ── */}
      <Panel title="Cash Position" subtitle="Cash-in, payables, ad spend, payroll.">
        <CashMeter
          available={data?.cashAvailable ?? 0}
          obligations={data?.cashObligations ?? 0}
          surplus={data?.cashSurplus ?? 0}
        />
      </Panel>
    </section>
  );
};
