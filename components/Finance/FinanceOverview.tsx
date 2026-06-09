'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, AlertCircle, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Legend, Cell, ReferenceLine } from 'recharts';
import type { PLData } from '@/lib/types/finance';
import { fmt, getCategoryLabel, getCategoryColor, MONTHS_SHORT } from './shared';

interface OverviewMetrics {
  revenue: number; expenses: number; netProfit: number;
  cogsTotal: number; opexTotal: number; grossMargin: number; netMargin: number;
}
interface PathaoMonthly { deliveredAmount: number; deliveredCount: number; }
interface PathaoMonthBucket {
  month: string; label: string;
  delivered: number; deliveredCount: number;
  returned: number; returnedCount: number;
}
interface ChartMonth {
  month: string; label: string; total_expense: number;
  ads_meta?: number; ads_google?: number; fabric?: number; accessories?: number;
  sewing?: number; packaging_material?: number; rent?: number; salary?: number;
  transport?: number; photoshoot?: number; miscellaneous?: number;
}

const KPICard = ({
  label, value, sub, color, positive, icon: Icon,
}: {
  label: string; value: string; sub?: string; color: string; positive?: boolean; icon: React.FC<any>;
}) => {
  const Trend = positive === undefined ? null : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      borderTop: `3px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ background: `${color}18`, borderRadius: 8, padding: 7, display: 'grid', placeItems: 'center' }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: '1.7rem', fontWeight: 900, letterSpacing: '-0.03em', color: color, lineHeight: 1 }}>{value}</span>
          {Trend && <Trend size={16} color={color} />}
        </div>
        {sub && <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 5 }}>{sub}</div>}
      </div>
    </div>
  );
};

const ChartCard = ({ title, sub, children, style }: { title: string; sub?: string; children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: '18px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
    ...style,
  }}>
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>{title}</div>
      {sub && <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
    {children}
  </div>
);

const barTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 800, marginBottom: 5, color: '#0f172a' }}>
        {typeof label === 'number' ? MONTHS_SHORT[label - 1] : label}
      </div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color || '#374151', marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>৳{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export const FinanceOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [pathaoMonthly, setPathaoMonthly] = useState<PathaoMonthly | null>(null);
  const [pathaoMonths, setPathaoMonths] = useState<PathaoMonthBucket[]>([]);
  const [finCharts, setFinCharts] = useState<ChartMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();

  const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    const sign = n >= 0 ? '+' : '−';
    if (abs >= 100000) return `${sign}৳${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000)   return `${sign}৳${(abs / 1000).toFixed(0)}k`;
    return `${sign}৳${abs}`;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const y = now.getFullYear();
      const m0 = now.getMonth();
      const monthFrom = `${y}-${String(m0 + 1).padStart(2, '0')}-01`;
      const monthTo = new Date(y, m0 + 1, 0).toISOString().slice(0, 10);

      const [plRes, pathaoRes, pathaoMonthsRes, finChartsRes] = await Promise.all([
        fetch(`/api/finance/reports?period=month&year=${y}&month=${m0 + 1}`),
        fetch(`/api/pathao/metrics?from=${monthFrom}&to=${monthTo}`),
        fetch('/api/pathao/monthly'),
        fetch('/api/finance/charts'),
      ]);

      if (!plRes.ok) throw new Error('Failed to load finance data');
      const plJson = await plRes.json();
      if (plJson.error) throw new Error(plJson.error);

      const pl: PLData = plJson.pl;
      setMetrics({
        revenue: pl.revenue.total, expenses: pl.cogs.total + pl.opex.total,
        netProfit: pl.net_profit, cogsTotal: pl.cogs.total, opexTotal: pl.opex.total,
        grossMargin: pl.gross_margin, netMargin: pl.net_margin,
      });

      if (pathaoRes.ok) {
        const pj = await pathaoRes.json();
        const d = pj.orderSummary?.delivered;
        if (d) setPathaoMonthly({ deliveredAmount: d.amount ?? 0, deliveredCount: d.count ?? 0 });
      }
      if (pathaoMonthsRes.ok) {
        const j = await pathaoMonthsRes.json();
        if (j.months) setPathaoMonths(j.months);
      }
      if (finChartsRes.ok) {
        const j = await finChartsRes.json();
        if (j.months) setFinCharts(j.months);
      }

      const breakdown = Object.entries({ ...pl.cogs, ...pl.opex })
        .filter(([k, v]) => k !== 'total' && (v as number) > 0)
        .map(([cat, val]) => ({ name: getCategoryLabel(cat), value: val as number, color: getCategoryColor(cat) }))
        .sort((a, b) => b.value - a.value);
      setExpenseBreakdown(breakdown);
      setTrend(plJson.trend || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem', gap: 12, color: '#94a3b8' }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.9rem' }}>Loading overview...</span>
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

  const m = metrics!;
  const revenue = pathaoMonthly ? pathaoMonthly.deliveredAmount : m.revenue;
  const revSub = pathaoMonthly
    ? `${pathaoMonthly.deliveredCount} orders · ${now.toLocaleString('default', { month: 'long' })}`
    : `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
  const netPositive = revenue - m.expenses >= 0;

  // Merge pathao revenue into trend for the yearly chart
  const mergedTrend = trend.map(t => {
    const monthKey = `${now.getFullYear()}-${String(t.month).padStart(2, '0')}`;
    const pathaoM = pathaoMonths.find(pm => pm.month === monthKey);
    // Use Pathao delivered COD value. If 0 or absent, fallback to manual ledger revenue
    return { month: t.month, revenue: pathaoM?.delivered || t.revenue, expenses: t.expenses };
  });
  const trendHasData = mergedTrend.some(t => t.revenue > 0 || t.expenses > 0);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
        <KPICard
          label="Revenue (MTD)" value={fmt(revenue)} sub={revSub}
          color="#16a34a" positive={revenue > 0} icon={TrendingUp}
        />
        <KPICard
          label="Total Expenses" value={fmt(m.expenses)} sub={`COGS ${fmt(m.cogsTotal)} · OPEX ${fmt(m.opexTotal)}`}
          color="#ef4444" icon={TrendingDown}
        />
        <KPICard
          label="Net Position (MTD)" value={fmt(revenue - m.expenses)}
          sub={`Based on Pathao COD + all expenses`}
          color={netPositive ? '#16a34a' : '#ef4444'} positive={netPositive} icon={DollarSign}
        />
        <KPICard
          label="Gross Margin" value={`${m.grossMargin.toFixed(1)}%`}
          sub="After COGS deduction"
          color={m.grossMargin >= 40 ? '#16a34a' : m.grossMargin >= 20 ? '#f59e0b' : '#ef4444'}
          icon={Percent}
        />
      </div>

      {/* Row 2: Revenue vs Expenses yearly + Expense breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 14 }}>
        <ChartCard title={`Revenue vs Expenses — ${now.getFullYear()}`} sub="Pathao COD revenue · logged production costs">
          {trendHasData ? (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={mergedTrend} barGap={3} barCategoryGap="32%">
                  <CartesianGrid vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="month" tickFormatter={v => MONTHS_SHORT[v - 1]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={barTooltip} />
                  <Legend wrapperStyle={{ fontSize: '0.74rem', paddingTop: 6 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {/* Net P&L strip — aligned with bars (Y-axis ~55px wide, no right pad) */}
              <div style={{ display: 'flex', marginTop: 6, paddingLeft: 55, paddingRight: 4 }}>
                {mergedTrend.map((d, i) => {
                  const net = d.revenue - d.expenses;
                  const hasData = d.revenue > 0 || d.expenses > 0;
                  return (
                    <div key={i} style={{
                      flex: 1, textAlign: 'center', fontSize: '0.62rem', fontWeight: 800,
                      color: hasData ? (net >= 0 ? '#16a34a' : '#ef4444') : '#e2e7ee',
                      background: hasData ? (net >= 0 ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)') : 'transparent',
                      borderRadius: 3, padding: '2px 1px', margin: '0 1px',
                    }}>
                      {hasData ? fmtShort(net) : '—'}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 6 }}>
              <span style={{ fontSize: '1.8rem' }}>📊</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>No data yet for {now.getFullYear()}</span>
              <span style={{ fontSize: '0.74rem' }}>Revenue comes from Pathao · expenses from Transactions tab</span>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Expenses This Month" sub="Breakdown by category">
          {expenseBreakdown.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>No expenses logged this month</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 220, overflowY: 'auto' }}>
              {expenseBreakdown.map(item => {
                const pct = m.expenses > 0 ? (item.value / m.expenses) * 100 : 0;
                return (
                  <div key={item.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{fmt(item.value)}</span>
                    </div>
                    <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 99, transition: 'width 600ms ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Delivered vs Returned + ROAS */}
      {pathaoMonths.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          <ChartCard title="Delivered vs Returned" sub="COD value · last 6 months">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pathaoMonths.slice(-6)} barGap={3} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={barTooltip} />
                <Legend wrapperStyle={{ fontSize: '0.74rem', paddingTop: 4 }} />
                <Bar dataKey="delivered" name="Delivered" fill="#16a34a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="returned" name="Returned" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Return on Ad Spend (ROAS)" sub="Revenue per ৳1 spent on ads · log ad spend in Transactions">
            {finCharts.some(fc => (fc.ads_meta || 0) + (fc.ads_google || 0) > 0) ? (() => {
              const roasData = pathaoMonths.slice(-6).map(pm => {
                const fc = finCharts.find(f => f.month === pm.month) || {};
                const adSpend = ((fc as any).ads_meta || 0) + ((fc as any).ads_google || 0);
                const roas = adSpend > 0 ? pm.delivered / adSpend : 0;
                return { label: pm.label, adSpend, revenue: pm.delivered, roas: parseFloat(roas.toFixed(2)) };
              });
              return (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={roasData} barCategoryGap="35%">
                    <CartesianGrid vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="bars" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="ratio" orientation="right" tick={{ fontSize: 11, fill: '#db2777' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}×`} />
                    <Tooltip formatter={(v: any, name: any) => [name === 'ROAS' ? `${v}×` : `৳${Number(v).toLocaleString()}`, name as string]} contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: '0.74rem', paddingTop: 4 }} />
                    <Bar yAxisId="bars" dataKey="adSpend" name="Ad Spend" fill="#fbbf24" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="bars" dataKey="revenue" name="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="ratio" type="monotone" dataKey="roas" name="ROAS" stroke="#db2777" strokeWidth={2} dot={{ r: 3, fill: '#db2777' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              );
            })() : (
              <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 6 }}>
                <span style={{ fontSize: '1.4rem' }}>📈</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>No ad spend logged yet</span>
                <span style={{ fontSize: '0.74rem', textAlign: 'center' }}>Log Meta/Google Ads in Transactions tab to see ROAS</span>
              </div>
            )}
          </ChartCard>
        </div>
      )}

    </div>
  );
};
