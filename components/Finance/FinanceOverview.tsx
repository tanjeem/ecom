'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, DollarSign, Percent, RefreshCw, AlertCircle,
  ArrowUpRight, ArrowDownRight, Megaphone, Package, RotateCcw, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fmt, MONTHS_SHORT } from './shared';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtK = (n: number) => {
  const a = Math.abs(n);
  if (a >= 100000) return `৳${(n / 100000).toFixed(1)}L`;
  if (a >= 1000) return `৳${(n / 1000).toFixed(0)}k`;
  return `৳${Math.round(n)}`;
};

// ─── sub-components ───────────────────────────────────────────────────────────

const HeroCard = ({
  label, value, delta, sub, color, icon: Icon, signal,
}: {
  label: string; value: string; delta?: number | null;
  sub?: string; color: string; icon: React.FC<any>;
  signal?: 'good' | 'warn' | 'bad';
}) => {
  const signalBg: Record<string, string> = { good: '#f0fdf4', warn: '#fffbeb', bad: '#fef2f2' };
  const signalBorder: Record<string, string> = { good: '#bbf7d0', warn: '#fde68a', bad: '#fecaca' };
  return (
    <div style={{
      background: signal ? signalBg[signal] : '#fff',
      border: `1.5px solid ${signal ? signalBorder[signal] : '#f1f5f9'}`,
      borderRadius: 14, padding: '22px 24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.67rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <div style={{ background: `${color}18`, borderRadius: 9, padding: 8, display: 'grid', placeItems: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', color, lineHeight: 1 }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {delta != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontSize: '0.69rem', fontWeight: 800,
              background: delta >= 0 ? '#dcfce7' : '#fee2e2',
              color: delta >= 0 ? '#15803d' : '#dc2626',
              borderRadius: 6, padding: '2px 7px',
            }}>
              {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {Math.abs(delta).toFixed(1)}% vs last month
            </span>
          )}
          {sub && <span style={{ fontSize: '0.71rem', color: '#94a3b8' }}>{sub}</span>}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string; sub?: string; color: string; icon: React.FC<any>;
}) => (
  <div style={{
    background: '#fff', borderRadius: 10, padding: '16px 18px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.03)',
    borderLeft: `3px solid ${color}`,
    display: 'flex', flexDirection: 'column', gap: 8,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <Icon size={13} color={color} />
    </div>
    <div style={{ fontSize: '1.4rem', fontWeight: 900, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '0.69rem', color: '#94a3b8', lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

const barTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 800, marginBottom: 5, color: '#0f172a' }}>{MONTHS_SHORT[Number(label) - 1]}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color, marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>৳{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ─── main component ───────────────────────────────────────────────────────────

export const FinanceOverview: React.FC = () => {
  const now = new Date();
  const y = now.getFullYear();
  const currentM = now.getMonth() + 1;
  const lastYear = currentM === 1 ? y - 1 : y;
  const lastMonth = currentM === 1 ? 12 : currentM - 1;
  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const currentMonthKey = `${y}-${String(currentM).padStart(2, '0')}`;

  const [plData, setPlData]           = useState<any>(null);
  const [pathaoData, setPathaoData]   = useState<any>(null);
  const [lastPathao, setLastPathao]   = useState<any>(null);
  const [pathaoMonths, setPathaoMonths] = useState<any[]>([]);
  const [metaSpend, setMetaSpend]     = useState<any[]>([]);
  const [finCharts, setFinCharts]     = useState<any[]>([]);
  const [trend, setTrend]             = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const monthFrom    = `${y}-${String(currentM).padStart(2, '0')}-01`;
      const monthTo      = new Date(y, currentM, 0).toISOString().slice(0, 10);
      const lastMonthFrom = `${lastYear}-${String(lastMonth).padStart(2, '0')}-01`;
      const lastMonthTo  = new Date(lastYear, lastMonth, 0).toISOString().slice(0, 10);

      const [plRes, pathaoRes, lastPathaoRes, pathaoMonthsRes, metaAdsRes, chartsRes] = await Promise.all([
        fetch(`/api/finance/reports?period=month&year=${y}&month=${currentM}`),
        fetch(`/api/pathao/metrics?from=${monthFrom}&to=${monthTo}`),
        fetch(`/api/pathao/metrics?from=${lastMonthFrom}&to=${lastMonthTo}`),
        fetch('/api/pathao/monthly'),
        fetch('/api/finance/ads'),
        fetch('/api/finance/charts'),
      ]);

      if (!plRes.ok) throw new Error('Failed to load finance data');
      const plJson = await plRes.json();
      if (plJson.error) throw new Error(plJson.error);
      setPlData(plJson);
      setTrend(plJson.trend || []);

      if (pathaoRes.ok)       setPathaoData(await pathaoRes.json());
      if (lastPathaoRes.ok)   setLastPathao(await lastPathaoRes.json());
      if (pathaoMonthsRes.ok) { const j = await pathaoMonthsRes.json(); if (j.months) setPathaoMonths(j.months); }
      if (chartsRes.ok)       { const j = await chartsRes.json(); if (j.months) setFinCharts(j.months); }
      if (metaAdsRes.ok) {
        const j = await metaAdsRes.json();
        if (Array.isArray(j)) {
          setMetaSpend(j.map((item: any) => ({
            month:          item.month as string,
            spend:          (Number(item.spend) || 0) * 130 * 1.15,
            storeRevenue:   Number(item.storeRevenue) || 0,
            deliveredAmount: Number(item.deliveredAmount) || 0,
          })));
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ─── loading / error ─────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem', gap: 12, color: '#94a3b8' }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.9rem' }}>Loading...</span>
    </div>
  );

  if (error) return (
    <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e7ee' }}>
      <AlertCircle size={28} color="#dc2626" style={{ marginBottom: 10 }} />
      <p style={{ color: '#dc2626', fontWeight: 600, margin: '0 0 6px' }}>Could not load finance data</p>
      <p style={{ color: '#64748b', fontSize: '0.83rem', margin: '0 0 16px' }}>{error}</p>
      <button style={{ padding: '8px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700 }} onClick={load}>Retry</button>
    </div>
  );

  // ─── derived values ──────────────────────────────────────────────────────────

  const pl          = plData?.pl;
  const delivered   = pathaoData?.orderSummary?.delivered  ?? { count: 0, amount: 0 };
  const returned    = pathaoData?.orderSummary?.returned   ?? { count: 0, amount: 0 };
  const processing  = pathaoData?.orderSummary?.processing ?? { count: 0 };
  const invoice     = pathaoData?.invoiceSummary           ?? null;
  const lastDelivered = lastPathao?.orderSummary?.delivered ?? { count: 0, amount: 0 };

  const currentMetaEntry = metaSpend.find(ms => ms.month === currentMonthKey);

  // Revenue: Meta reconciled (prepaid ledger + Pathao COD) → falls back to raw Pathao delivered
  const revenue = currentMetaEntry
    ? (currentMetaEntry.storeRevenue + currentMetaEntry.deliveredAmount) || delivered.amount
    : delivered.amount;
  const lastRevenue = lastDelivered.amount;
  const momDelta = lastRevenue > 0 ? ((revenue - lastRevenue) / lastRevenue) * 100 : null;

  // Expenses: swap manual Meta entry for the authoritative Meta API spend
  const metaSpendBDT     = currentMetaEntry?.spend ?? 0;
  const manualMetaLogged = pl?.opex?.ads_meta ?? 0;
  const totalExpenses    = pl ? (pl.cogs.total + pl.opex.total - manualMetaLogged + metaSpendBDT) : 0;
  const netPosition      = revenue - totalExpenses;

  // Return rate
  const totalClosed  = delivered.count + returned.count;
  const returnRate   = totalClosed > 0 ? (returned.count / totalClosed) * 100 : 0;
  const returnSignal = (returnRate < 15 ? 'good' : returnRate < 25 ? 'warn' : 'bad') as 'good' | 'warn' | 'bad';
  const returnColor  = { good: '#16a34a', warn: '#d97706', bad: '#dc2626' }[returnSignal];

  // Supporting metrics
  const aov         = delivered.count > 0 ? delivered.amount / delivered.count : 0;
  const grossMargin = pl?.gross_margin ?? 0;
  const grossMarginColor = grossMargin >= 45 ? '#16a34a' : grossMargin >= 35 ? '#d97706' : '#dc2626';
  const mer         = metaSpendBDT > 0 ? revenue / metaSpendBDT : null;
  const merColor    = mer != null ? (mer >= 4 ? '#16a34a' : mer >= 2.5 ? '#d97706' : '#dc2626') : '#94a3b8';
  const cashInTransit = invoice
    ? (invoice.paymentInProcess ?? 0) + (invoice.paymentInReview ?? 0) + (invoice.paymentPreparingForInvoice ?? 0)
    : 0;

  // Break-even progress
  const breakEvenPct       = totalExpenses > 0 ? Math.min(1, revenue / totalExpenses) : 0;
  const breakEvenShortfall = totalExpenses - revenue;

  // YTD chart — merge Pathao revenue and Meta-adjusted expenses per month
  const mergedTrend = trend
    .filter(t => t.month <= currentM)
    .map(t => {
      const mk      = `${y}-${String(t.month).padStart(2, '0')}`;
      const pathaoM = pathaoMonths.find(pm => pm.month === mk);
      const metaE   = metaSpend.find(ms => ms.month === mk);
      const fc      = finCharts.find(f => f.month === mk);
      const adjExp  = t.expenses - (fc?.ads_meta ?? 0) + (metaE?.spend ?? 0);
      return {
        month:    t.month,
        revenue:  metaE
          ? (metaE.storeRevenue + metaE.deliveredAmount) || pathaoM?.delivered || t.revenue
          : pathaoM?.delivered || t.revenue,
        expenses: Math.max(0, adjExp),
      };
    });

  const netSignal = netPosition >= 0 ? 'good' : 'bad' as 'good' | 'bad';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>{currentMonthName} {y}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>Pathao COD · Prepaid · Meta Ads</div>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#f8fafc', border: '1px solid #e2e7ee', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Hero row — 3 large cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <HeroCard
          label="Revenue — MTD"
          value={fmt(revenue)}
          delta={momDelta}
          sub={`${delivered.count} orders delivered`}
          color="#16a34a"
          icon={TrendingUp}
          signal={revenue > 0 ? 'good' : undefined}
        />
        <HeroCard
          label="Net Position — MTD"
          value={fmtK(netPosition)}
          sub={netPosition >= 0 ? 'Profitable this month' : 'Operating at a loss'}
          color={netPosition >= 0 ? '#2563eb' : '#dc2626'}
          icon={DollarSign}
          signal={netSignal}
        />
        <HeroCard
          label="Return Rate"
          value={totalClosed > 0 ? `${returnRate.toFixed(1)}%` : '—'}
          sub={`${returned.count} returned · ${delivered.count} delivered`}
          color={returnColor}
          icon={RotateCcw}
          signal={totalClosed > 0 ? returnSignal : undefined}
        />
      </div>

      {/* Supporting metrics — 4 smaller cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard
          label="Avg Order Value"
          value={aov > 0 ? fmt(aov) : '—'}
          sub={`Based on ${delivered.count} delivered orders`}
          color="#6366f1"
          icon={Package}
        />
        <StatCard
          label="Gross Margin"
          value={pl ? `${grossMargin.toFixed(1)}%` : '—'}
          sub={pl ? `Net margin: ${pl.net_margin.toFixed(1)}%` : undefined}
          color={grossMarginColor}
          icon={Percent}
        />
        <StatCard
          label="Marketing Efficiency"
          value={mer != null ? `${mer.toFixed(1)}×` : '—'}
          sub={
            mer == null ? 'No ad spend this month'
            : mer >= 4    ? 'Strong — room to scale spend'
            : mer >= 2.5  ? 'Moderate — watch CPAs'
            : 'Weak — review campaigns'
          }
          color={merColor}
          icon={Megaphone}
        />
        <StatCard
          label="Cash In Transit"
          value={cashInTransit > 0 ? fmt(cashInTransit) : '৳0'}
          sub="Pathao pending payout"
          color="#d97706"
          icon={Clock}
        />
      </div>

      {/* Break-even bar */}
      {totalExpenses > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Monthly Break-Even</div>
              <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: 3 }}>
                Total costs this month: {fmt(totalExpenses)} &nbsp;·&nbsp; COGS + OPEX + Ads
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {breakEvenShortfall > 0 ? (
                <>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#dc2626' }}>{fmtK(breakEvenShortfall)} to go</div>
                  <div style={{ fontSize: '0.67rem', color: '#94a3b8', marginTop: 2 }}>Revenue so far: {fmt(revenue)}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#16a34a' }}>{fmtK(netPosition)} profit</div>
                  <div style={{ fontSize: '0.67rem', color: '#94a3b8', marginTop: 2 }}>Costs cleared</div>
                </>
              )}
            </div>
          </div>
          <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${breakEvenPct * 100}%`,
              background: breakEvenShortfall > 0
                ? `linear-gradient(90deg, #fbbf24, #f59e0b)`
                : `linear-gradient(90deg, #4ade80, #16a34a)`,
              borderRadius: 99,
              transition: 'width 800ms ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.64rem', color: '#cbd5e1' }}>
            <span>৳0</span>
            <span>{fmt(totalExpenses)}</span>
          </div>
        </div>
      )}

      {/* YTD chart + Order Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 290px', gap: 14 }}>

        {/* YTD bar chart */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.83rem', fontWeight: 800, color: '#0f172a' }}>Revenue vs Expenses — {y}</div>
          <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: 2, marginBottom: 14 }}>Pathao COD · COGS + OPEX + Meta</div>
          {mergedTrend.some(t => t.revenue > 0 || t.expenses > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mergedTrend} barGap={3} barCategoryGap="12%">
                <CartesianGrid vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="month" tickFormatter={v => MONTHS_SHORT[v - 1]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={barTooltip} />
                <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.83rem' }}>
              No data yet for {y}
            </div>
          )}
        </div>

        {/* Order Health */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: '0.83rem', fontWeight: 800, color: '#0f172a' }}>Order Health</div>
            <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: 2 }}>{currentMonthName} · Pathao</div>
          </div>

          {[
            {
              label: 'Delivered',
              count: delivered.count,
              amount: delivered.amount,
              color: '#16a34a',
              bg: '#f0fdf4',
            },
            {
              label: 'In Transit',
              count: processing.count,
              amount: null,
              color: '#2563eb',
              bg: '#eff6ff',
            },
            {
              label: 'Returned',
              count: returned.count,
              amount: returned.amount > 0 ? returned.amount : null,
              color: returnColor,
              bg: returnSignal === 'good' ? '#f0fdf4' : returnSignal === 'warn' ? '#fffbeb' : '#fef2f2',
            },
          ].map(item => (
            <div key={item.label} style={{
              background: item.bg, borderRadius: 9, padding: '12px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '0.63rem', fontWeight: 700, color: item.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{item.count}</div>
                <div style={{ fontSize: '0.63rem', color: '#94a3b8', marginTop: 2 }}>orders</div>
              </div>
              {item.amount != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.63rem', color: '#94a3b8', marginBottom: 2 }}>value</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: item.color }}>{fmt(item.amount)}</div>
                </div>
              )}
            </div>
          ))}

          {cashInTransit > 0 && (
            <div style={{ background: '#fffbeb', borderRadius: 9, padding: '12px 14px', borderLeft: '3px solid #d97706' }}>
              <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Pathao Holding</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>{fmt(cashInTransit)}</div>
              <div style={{ fontSize: '0.63rem', color: '#94a3b8', marginTop: 2 }}>Pending payout to your account</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
