'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Panel } from '@/components/Common/Panel';
import { CashMeter } from '@/components/Dashboard/CashMeter';
import { OrderPipeline } from '@/components/Dashboard/OrderPipeline';
import { StockAlerts } from '@/components/Dashboard/StockAlerts';
import {
  ShoppingBag, DollarSign, TrendingUp, Coins, Percent, Activity,
  ArrowUpRight, ArrowDownRight, RefreshCw, Calendar, Truck, Landmark
} from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: '📅 Custom' },
];

function fmt(n: number) { return 'BDT ' + n.toLocaleString(); }

const fmtDate = (s: string) => {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 8px 24px -4px rgba(16, 24, 40, 0.08)',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: '0.72rem',
      }}>
        <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 2 }}>
          {label ? fmtDate(String(label)) : ''}
        </div>
        <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.82rem' }}>
          {formatter ? formatter(payload[0].value) : payload[0].value}
        </div>
      </div>
    );
  }
  return null;
};

// Compact Premium Panel Style Token
const premiumPanelStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  boxShadow: '0 4px 20px rgba(27, 35, 45, 0.01), 0 1px 2px rgba(0, 0, 0, 0.01)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
};

function KpiCard({ label, value, pct, hasPrev, sub, accent, icon: Icon, loading }: {
  label: string; value: string | number; pct: number; hasPrev: boolean;
  sub?: string; accent: string; icon: React.ComponentType<any>; loading: boolean;
}) {
  const up = pct > 0;
  const trendColor = up ? '#10b981' : pct < 0 ? '#ef4444' : '#64748b';
  const trendBg = up ? 'rgba(16, 185, 129, 0.08)' : pct < 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(100, 116, 139, 0.08)';

  return (
    <div className="metric-card premium-kpi-card" style={{
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: '1px solid rgba(148, 163, 184, 0.12)',
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 4px 20px rgba(27, 35, 45, 0.01), 0 1px 2px rgba(0, 0, 0, 0.01)',
      borderRadius: 12,
      padding: '14px 18px',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0))`,
      }} />

      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}>
          <div style={{
            width: 20,
            height: 20,
            border: '2px solid rgba(0,0,0,0.1)',
            borderTopColor: accent,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{
          fontSize: '0.68rem',
          color: '#64748b',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {label}
        </span>
        <div style={{
          padding: 6,
          borderRadius: 6,
          background: `rgba(${parseInt(accent.slice(1,3), 16) || 37}, ${parseInt(accent.slice(3,5), 16) || 99}, ${parseInt(accent.slice(5,7), 16) || 235}, 0.06)`,
          color: accent,
        }}>
          <Icon size={15} strokeWidth={2.2} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.45rem', fontWeight: 850, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {value}
        </span>

        {hasPrev && pct !== 0 && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            padding: '1px 4px',
            borderRadius: 4,
            background: trendBg,
            color: trendColor,
            fontSize: '0.65rem',
            fontWeight: 750,
          }}>
            {up ? <ArrowUpRight size={10} strokeWidth={2.5} /> : <ArrowDownRight size={10} strokeWidth={2.5} />}
            {Math.abs(pct)}%
          </div>
        )}
      </div>

      {sub && (
        <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

interface DailyPoint { date: string; orders: number; revenue: number }
interface TopProduct  { product: string; orders: number; revenue: number }
interface PathaoMetric{ status: string; count: number; value: number }

interface PathaoPortalMetrics {
  totalOrders: number;
  orderSummary: {
    delivered:  { count: number; amount: number; pct: number };
    processing: { count: number; amount: number; pct: number };
    returned:   { count: number; amount: number; pct: number };
    paidReturn: { count: number; amount: number; pct: number };
    total:      { count: number; amount: number };
  } | null;
  statusBreakdown: Record<string, { count: number; amount: number }>;
  allTimeStatusBreakdown: Record<string, { count: number; amount: number }>;
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
  grossMarginValue: number; grossMarginValuePct: number;
  avgMarginPct: number; avgMarginPctPct: number;
  totalAdSpend: number; totalAdRevenue: number; blendedRoas: number;
  pathaoMetrics: PathaoMetric[];
  allPathaoMetrics: PathaoMetric[];
  dailyChart: DailyPoint[];
  topProducts: TopProduct[];
  pipelineStages: { name: string; count: number }[];
  cashAvailable: number; cashReceivables: number; cashProjected: number;
}

function getPathaoDates(period: Period, customAfter: string, customBefore: string) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today = new Date();
  if (period === 'custom') return { from: customAfter || undefined, to: customBefore || undefined };
  if (period === 'today') { const s = fmt(today); return { from: s, to: s }; }
  if (period === 'week')  { const s = new Date(today); s.setDate(s.getDate()-6); return { from: fmt(s), to: fmt(today) }; }
  if (period === 'month') { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { from: fmt(s), to: fmt(today) }; }
  if (period === 'year')  { const s = new Date(today.getFullYear(), 0, 1); return { from: fmt(s), to: fmt(today) }; }
  return { from: undefined, to: undefined };
}

export const DashboardView: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month');
  const [customAfter, setCustomAfter] = useState('');
  const [customBefore, setCustomBefore] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [data, setData] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathaoData, setPathaoData] = useState<PathaoPortalMetrics | null>(null);
  const [pathaoLoading, setPathaoLoading] = useState(true);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(true);

  const fetchMetrics = useCallback(async (p: Period, ca?: string, cb?: string, force?: boolean) => {
    setIsLoading(true); setError(null);
    try {
      let url = '/api/dashboard/metrics?period=' + p;
      if (p === 'custom' && ca) { url += '&after=' + ca; if (cb) url += '&before=' + cb; }
      if (force) url += '&refresh=true';
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally { setIsLoading(false); }
  }, []);

  const fetchPathaoMetrics = useCallback(async (p: Period, ca: string, cb: string, force?: boolean) => {
    setPathaoLoading(true);
    try {
      const { from, to } = getPathaoDates(p, ca, cb);
      let url = '/api/pathao/metrics';
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (force) params.set('refresh', 'true');
      const qs = params.toString();
      if (qs) url += '?' + qs;
      const res = await fetch(url);
      const json = await res.json();
      setPathaoData(json);
    } catch {
      // silently fail
    } finally { setPathaoLoading(false); }
  }, []);

  const fetchInventoryAlerts = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      setLowStock(json.lowStock || []);
    } catch (err) {
      console.error('Failed to load inventory alerts:', err);
    } finally {
      setStockLoading(false);
    }
  }, []);

  useEffect(() => {
    if (period !== 'custom') {
      fetchMetrics(period);
      fetchPathaoMetrics(period, customAfter, customBefore);
      fetchInventoryAlerts();
    }
  }, [period, fetchMetrics, fetchPathaoMetrics, fetchInventoryAlerts, customAfter, customBefore]);

  const hasPrev = period !== 'all' && period !== 'custom';

  const allPathaoLookup: Record<string, PathaoMetric> = {};

  // Start with WooCommerce allPathaoMetrics as the base
  for (const m of data?.allPathaoMetrics ?? []) allPathaoLookup[m.status] = m;

  // Override with live Pathao portal data
  const allTimeBreakdown = pathaoData?.allTimeStatusBreakdown ?? {};
  for (const [status, g] of Object.entries(allTimeBreakdown)) {
    allPathaoLookup[status] = { status, count: g.count, value: g.amount };
  }

  return (
    <section className="view is-active" id="dashboard-view" data-title="Dashboard" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .premium-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -6px rgba(16, 24, 40, 0.05), 0 1px 2px rgba(0, 0, 0, 0.01) !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
        }
        .segmented-control {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 2px;
        }
        .segmented-control button {
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.72rem;
          padding: 3px 8px;
          transition: all 0.2s;
        }
        .segmented-control button.is-selected {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04);
        }
        .premium-sub-badge {
          font-size: 0.68rem;
          color: #059669;
          background: #ecfdf5;
          border-radius: 4px;
          padding: 2px 6px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
        }
      `}</style>

      {/* ── Date filter bar (Super Compact Single Row layout) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="segmented-control">
            {PERIODS.map(({ key, label }) => (
              <button key={key} className={period === key ? 'is-selected' : ''}
                onClick={() => { setPeriod(key); setShowCustom(key === 'custom'); }} type="button">
                {label}
              </button>
            ))}
          </div>
          <button className="secondary-action" onClick={() => {
            fetchMetrics(period, customAfter, customBefore, true);
            fetchPathaoMetrics(period, customAfter, customBefore, true);
            fetchInventoryAlerts();
          }}
            type="button" style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, minHeight: 24, padding: 0, borderRadius: 6 }}>
            <RefreshCw size={10} />
          </button>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
          {isLoading ? 'Syncing operational data...' : data?.label}
        </div>
      </div>

      {/* Custom date range picker */}
      {showCustom && (
        <div style={{
          background: '#fff', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 8,
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          boxShadow: '0 2px 12px rgba(0,0,0,0.01)', marginTop: -8
        }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Custom:</span>
          <input type="date" value={customAfter} onChange={e => setCustomAfter(e.target.value)}
            style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: '0.78rem', color: '#0f172a' }} />
          <span style={{ color: '#94a3b8' }}>→</span>
          <input type="date" value={customBefore} onChange={e => setCustomBefore(e.target.value)}
            style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: '0.78rem', color: '#0f172a' }} />
          <button className="primary-action"
            onClick={() => {
              if (customAfter) {
                fetchMetrics('custom', customAfter, customBefore);
                fetchPathaoMetrics('custom', customAfter, customBefore);
                fetchInventoryAlerts();
              }
            }}
            style={{ padding: '4px 12px', fontSize: '0.78rem', height: 'auto', minHeight: 'auto' }} type="button">
            Apply
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem', background: '#fef2f2', color: '#c23a3a', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* ── Executive Performance Scorecard ── */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Executive Performance Scorecard
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
        }}>
          <KpiCard label="Gross Revenue" value={fmt(data?.totalValue ?? 0)}
            pct={data?.totalValuePct ?? 0} hasPrev={hasPrev} accent="#3b82f6" icon={DollarSign} loading={isLoading} />
          
          <KpiCard label="Total Orders" value={data?.totalOrders ?? 0}
            pct={data?.totalOrdersPct ?? 0} hasPrev={hasPrev} accent="#8b5cf6" icon={ShoppingBag} loading={isLoading}
            sub={`Awaiting Dispatch: ${data?.processingOrders ?? 0}`} />
          
          <KpiCard label="Average Order Value" value={fmt(data?.avgOrderValue ?? 0)}
            pct={data?.avgOrderValuePct ?? 0} hasPrev={hasPrev} accent="#ec4899" icon={TrendingUp} loading={isLoading} />

          <KpiCard label="Estimated Gross Profit" value={fmt(data?.grossMarginValue ?? 0)}
            pct={data?.grossMarginValuePct ?? 0} hasPrev={hasPrev} accent="#10b981" icon={Coins} loading={isLoading}
            sub={`Average Margin: ${data?.avgMarginPct ?? 0}%`} />

          <KpiCard label="Avg Gross Margin %" value={`${data?.avgMarginPct ?? 0}%`}
            pct={data?.avgMarginPctPct ?? 0} hasPrev={hasPrev} accent="#f59e0b" icon={Percent} loading={isLoading}
            sub={`vs prev period`} />

          <KpiCard label="Meta Ads Blended ROAS" value={`${data?.blendedRoas ?? 0}x`}
            pct={0} hasPrev={false} accent="#6366f1" icon={Activity} loading={isLoading}
            sub={`Spend: $${(data?.totalAdSpend ?? 0).toLocaleString()} · Rev: $${(data?.totalAdRevenue ?? 0).toLocaleString()}`} />
        </div>
      </div>

      {/* ── Revenue & Orders Charting Panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        <Panel title="Revenue Performance" subtitle="Daily gross sales volume" className="panel" style={premiumPanelStyle}>
          {data?.dailyChart && data.dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={data.dailyChart} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }} tickLine={false} axisLine={false} tickFormatter={v => '৳' + (v/1000).toFixed(0) + 'k'} />
                <Tooltip content={<CustomTooltip formatter={(v: any) => fmt(Number(v))} />} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
              {isLoading ? 'Syncing chart data...' : 'No sales data for this range'}
            </div>
          )}
        </Panel>

        <Panel title="Order Volumes" subtitle="Daily ticket counts" className="panel" style={premiumPanelStyle}>
          {data?.dailyChart && data.dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={data.dailyChart} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip formatter={(v: any) => `${v} orders`} />} />
                <Bar dataKey="orders" fill="#8b5cf6" radius={[3,3,0,0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
              {isLoading ? 'Syncing chart data...' : 'No order data for this range'}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Operations & Courier Pipelines Section ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 16, alignItems: 'stretch' }}>
        {/* Unified WooCommerce Pipeline and Courier Delivery Card */}
        <Panel title="Fulfillment & Courier Pipelines" subtitle="WooCommerce live order queue status & Pathao courier dispatch" style={premiumPanelStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                WooCommerce Order Handoff Queue
              </div>
              <OrderPipeline stages={data?.pipelineStages ?? []} />
            </div>

            <div style={{ height: 1, backgroundColor: '#f1f5f9' }} />

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Pathao Courier Delivery Status
                </span>
                <span className="premium-sub-badge" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                  <Truck size={10} style={{ marginRight: 2 }} /> Live Feed
                </span>
              </div>
              {(() => {
                const os = pathaoData?.orderSummary;
                const total = pathaoData?.totalOrders ?? 0;
                const cards = [
                  { label: 'Delivered',   count: os?.delivered.count  ?? 0, amount: os?.delivered.amount  ?? 0, pct: os?.delivered.pct  ?? 0, color: '#10b981', showAmt: true  },
                  { label: 'Processing',  count: os?.processing.count ?? 0, amount: os?.processing.amount ?? 0, pct: os?.processing.pct ?? 0, color: '#3b82f6', showAmt: false },
                  { label: 'Returned',    count: os?.returned.count   ?? 0, amount: os?.returned.amount   ?? 0, pct: os?.returned.pct   ?? 0, color: '#ef4444', showAmt: true  },
                  { label: 'Paid Return', count: os?.paidReturn.count ?? 0, amount: os?.paidReturn.amount ?? 0, pct: os?.paidReturn.pct ?? 0, color: '#0f766e', showAmt: true  },
                  { label: 'Total',       count: total,                       amount: os?.total.amount     ?? 0, pct: 100,                    color: '#6366f1', showAmt: true  },
                ];
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                    {cards.map(({ label, count, amount, pct, color, showAmt }) => (
                      <div key={label} style={{
                        background: '#ffffff',
                        border: '1px solid #f1f5f9',
                        borderLeft: '3px solid ' + color,
                        borderRadius: 6,
                        padding: '10px 12px',
                      }}>
                        <div style={{ fontSize: '0.58rem', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 850, color: '#0f172a', lineHeight: 1 }}>
                          {pathaoLoading ? '…' : count}
                          <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 400 }}> orders</span>
                        </div>
                        {showAmt && <div style={{ marginTop: 2, fontSize: '0.75rem', fontWeight: 750, color: '#334155' }}>{pathaoLoading ? '…' : fmt(amount)}</div>}
                        <div style={{ marginTop: 2, fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>{pathaoLoading ? '…' : pct.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </Panel>

        {/* Stock Alerts Panel on the Right */}
        <Panel title="Stock Alerts" subtitle="Low inventory variant warning levels" style={premiumPanelStyle}>
          {stockLoading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Scanning variants...</div>
          ) : (
            <div style={{ marginTop: 4 }}><StockAlerts alerts={lowStock} /></div>
          )}
        </Panel>
      </div>

      {/* ── Logistics Performance & Financial Health ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16, alignItems: 'stretch' }}>
        {/* Left Column: COD Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pathaoData?.invoiceSummary && (
            <Panel title="COD Settlement Breakdown" subtitle="Pathao payout status details" style={premiumPanelStyle}
              actions={<span className="premium-sub-badge"><Landmark size={10} style={{ marginRight: 3 }} /> Transits</span>}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 4 }}>
                {[
                  { label: 'Payment In Review',          value: pathaoData.invoiceSummary.paymentInReview,            color: '#f59e0b' },
                  { label: 'Preparing Invoice',       value: pathaoData.invoiceSummary.paymentPreparingForInvoice, color: '#8b5cf6' },
                  { label: 'Payment in Process',          value: pathaoData.invoiceSummary.paymentInProcess,           color: '#3b82f6' },
                  { label: 'Last Payment Sent',           value: pathaoData.invoiceSummary.paymentSent,                color: '#10b981' },
                  { label: 'Lifetime Earning',            value: pathaoData.invoiceSummary.lifetimeEarning,            color: '#0f766e' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color }}>{pathaoLoading ? '…' : fmt(value)}</div>
                  </div>
                ))}
                <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Last Invoice Date</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>{pathaoData.invoiceSummary.lastInvoiceDate}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>via {pathaoData.invoiceSummary.paymentMethod}</div>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* Right Column: Cash Position and Best Sellers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cash Position Panel */}
          <Panel title="Cash Flow & Position" subtitle="Dynamic cash flow available vs pending payouts" style={premiumPanelStyle}>
            <div style={{ marginTop: 4 }}>
              <CashMeter
                available={data?.cashAvailable ?? 0}
                receivables={data?.cashReceivables ?? 0}
                projected={data?.cashProjected ?? 0}
                currency="৳ "
              />
            </div>
          </Panel>

          {/* Top Products Panel */}
          <Panel title="Top Products by Revenue" subtitle="Active period product rankings" style={premiumPanelStyle}>
            {isLoading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Loading catalog sales...</div>
            ) : data?.topProducts && data.topProducts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {/* header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, paddingBottom: 4,
                  fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid #f1f5f9' }}>
                  <span>Product SKU</span><span style={{ textAlign: 'right' }}>Orders</span><span style={{ textAlign: 'right' }}>Revenue</span>
                </div>
                {data.topProducts.map((p, i) => {
                  const maxRev = data.topProducts[0]?.revenue || 1;
                  const pct = Math.round((p.revenue / maxRev) * 100);
                  return (
                    <div key={p.product} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10,
                      paddingBottom: i < data.topProducts.length - 1 ? 6 : 0,
                      borderBottom: i < data.topProducts.length - 1 ? '1px solid #f8fafc' : 'none',
                      alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{p.product}</div>
                        <div style={{ height: 3, background: '#f1f5f9', borderRadius: 1, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', background: '#3b82f6', borderRadius: 1 }} />
                        </div>
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', textAlign: 'right', minWidth: 30 }}>{p.orders}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 750, color: '#0f172a', textAlign: 'right', minWidth: 80 }}>{fmt(p.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No product sales recorded</div>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
};
