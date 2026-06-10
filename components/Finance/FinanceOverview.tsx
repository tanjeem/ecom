'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, AlertCircle, RefreshCw,
  ArrowUpRight, ArrowDownRight, Megaphone,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PLData } from '@/lib/types/finance';
import { fmt, getCategoryLabel, getCategoryColor, MONTHS_SHORT } from './shared';

interface OverviewMetrics {
  revenue: number; expenses: number; netProfit: number;
  cogsTotal: number; opexTotal: number; grossMargin: number; netMargin: number;
  adsMeta: number; adsGoogle: number;
}
interface MetaMonthSpend { month: string; label: string; spend: number; storeRevenue: number; deliveredAmount: number; }
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
  label, value, sub, color, positive, icon: Icon, badge,
}: {
  label: string; value: string; sub?: string; color: string;
  positive?: boolean; icon: React.FC<any>; badge?: string;
}) => {
  const Trend = positive === undefined ? null : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      borderTop: `3px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: `${color}18`, color: color,
          borderRadius: 99, padding: '2px 8px',
          fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em',
        }}>{badge}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ background: `${color}18`, borderRadius: 8, padding: 7, display: 'grid', placeItems: 'center' }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: '1.7rem', fontWeight: 900, letterSpacing: '-0.03em', color, lineHeight: 1 }}>{value}</span>
          {Trend && <Trend size={16} color={color} />}
        </div>
        {sub && <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 5 }}>{sub}</div>}
      </div>
    </div>
  );
};

const ChartCard = ({ title, sub, children, style }: {
  title: string; sub?: string; children: React.ReactNode; style?: React.CSSProperties;
}) => (
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

// Compact label for inside bars: ৳45k / ৳1.2L
const fmtBar = (v: any) => {
  const n = Number(v);
  if (!n || n <= 0) return '';
  if (n >= 100000) return `৳${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(0)}k`;
  return `৳${n}`;
};

// Only renders the label if the bar is tall enough to contain it
const BarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  const text = fmtBar(value);
  if (!text || height < 20) return null;
  return (
    <text x={x + width / 2} y={y + 13} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={800}>
      {text}
    </text>
  );
};

export const FinanceOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [pathaoMonthly, setPathaoMonthly] = useState<PathaoMonthly | null>(null);
  const [pathaoMonths, setPathaoMonths] = useState<PathaoMonthBucket[]>([]);
  const [finCharts, setFinCharts] = useState<ChartMonth[]>([]);
  const [metaSpend, setMetaSpend] = useState<MetaMonthSpend[]>([]);
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

      const [plRes, pathaoRes, pathaoMonthsRes, finChartsRes, metaAdsRes] = await Promise.all([
        fetch(`/api/finance/reports?period=month&year=${y}&month=${m0 + 1}`),
        fetch(`/api/pathao/metrics?from=${monthFrom}&to=${monthTo}`),
        fetch('/api/pathao/monthly'),
        fetch('/api/finance/charts'),
        fetch('/api/finance/ads'),
      ]);

      if (!plRes.ok) throw new Error('Failed to load finance data');
      const plJson = await plRes.json();
      if (plJson.error) throw new Error(plJson.error);

      const pl: PLData = plJson.pl;
      setMetrics({
        revenue: pl.revenue.total, expenses: pl.cogs.total + pl.opex.total,
        netProfit: pl.net_profit, cogsTotal: pl.cogs.total, opexTotal: pl.opex.total,
        grossMargin: pl.gross_margin, netMargin: pl.net_margin,
        adsMeta: pl.opex.ads_meta,
        adsGoogle: pl.opex.ads_google,
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
      if (metaAdsRes.ok) {
        const j = await metaAdsRes.json();
        if (Array.isArray(j)) {
          // Meta API returns spend in USD — convert to BDT (rate: 130, VAT: 15%)
          setMetaSpend(j.map((item: any) => {
            const spendUSD = Number(item.spend) || 0;
            return {
              month: item.month as string,
              label: item.label as string,
              spend: spendUSD * 130 * 1.15,
              storeRevenue: Number(item.storeRevenue) || 0,
              deliveredAmount: Number(item.deliveredAmount) || 0,
            };
          }));
        }
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
  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Meta API is the authoritative source for ad spend
  const currentMetaSpend = metaSpend.find(ms => ms.month === currentMonthKey)?.spend ?? 0;
  const roasMTD = currentMetaSpend > 0 ? parseFloat((revenue / currentMetaSpend).toFixed(2)) : null;

  // Total expenses = everything from P&L (minus manually-logged ads_meta) + Meta API spend
  const adjustedTotalExpenses = m.expenses - m.adsMeta + currentMetaSpend;
  const netPositive = revenue - adjustedTotalExpenses >= 0;

  // Only render months that have already happened — backend adds fixed costs to all 12 months
  // including future ones, making them show non-zero expenses with zero revenue.
  const currentMonth = now.getMonth() + 1;
  const mergedTrend = trend
    .filter(t => t.month <= currentMonth)
    .map(t => {
      const monthKey = `${now.getFullYear()}-${String(t.month).padStart(2, '0')}`;
      const pathaoM = pathaoMonths.find(pm => pm.month === monthKey);
      const metaEntry = metaSpend.find(ms => ms.month === monthKey);
      const fc = finCharts.find(f => f.month === monthKey);
      const manualAdsMeta = fc?.ads_meta ?? 0;
      const metaApiSpend = metaEntry?.spend ?? 0;
      const adjustedExpenses = t.expenses - manualAdsMeta + metaApiSpend;
      return {
        month: t.month,
        // Match the Facebook Ads reconciliation ledger: storeRevenue (prepaid+COD) + deliveredAmount (Pathao COD)
        revenue: metaEntry
          ? (metaEntry.storeRevenue + metaEntry.deliveredAmount) || t.revenue
          : pathaoM?.delivered || t.revenue,
        expenses: Math.max(0, adjustedExpenses),
      };
    });
  const trendHasData = mergedTrend.some(t => t.revenue > 0 || t.expenses > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Finance Overview</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
            {currentMonthName} {now.getFullYear()} · Pathao COD + logged transactions
          </div>
        </div>
        <button
          onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#f8fafc', border: '1px solid #e2e7ee', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* KPI row — 5 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
        <KPICard
          label="Revenue (MTD)" value={fmt(revenue)} sub={revSub}
          color="#16a34a" positive={revenue > 0} icon={TrendingUp}
        />
        <KPICard
          label="Total Expenses" value={fmt(adjustedTotalExpenses)}
          sub={`COGS ${fmt(m.cogsTotal)} · Meta ৳${currentMetaSpend > 0 ? (currentMetaSpend / 1000).toFixed(0) + 'k' : '0'}`}
          color="#ef4444" icon={TrendingDown}
        />
        <KPICard
          label="Net Position (MTD)" value={fmt(revenue - adjustedTotalExpenses)}
          sub={netPositive ? 'Profitable this month' : 'Operating at a loss'}
          color={netPositive ? '#16a34a' : '#ef4444'} positive={netPositive} icon={DollarSign}
        />
        <KPICard
          label="Gross Margin" value={`${m.grossMargin.toFixed(1)}%`}
          sub={`Net margin: ${m.netMargin.toFixed(1)}%`}
          color={m.grossMargin >= 40 ? '#16a34a' : m.grossMargin >= 20 ? '#f59e0b' : '#ef4444'}
          icon={Percent}
        />
        <KPICard
          label="Meta Ads Spend (MTD)"
          value={currentMetaSpend > 0 ? fmt(currentMetaSpend) : '৳0'}
          sub={roasMTD !== null ? `ROAS ${roasMTD}× · ${currentMonthName}` : 'No ad spend this month'}
          color="#db2777"
          icon={Megaphone}
          badge={roasMTD !== null ? `${roasMTD}× ROAS` : undefined}
        />
      </div>

      {/* Revenue vs Expenses — yearly, fat bars with values inside */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 14 }}>
        <ChartCard
          title={`Revenue vs Expenses — ${now.getFullYear()}`}
          sub="Pathao COD revenue · COGS + OPEX + Meta Ads spend"
        >
          {trendHasData ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={mergedTrend} barGap={3} barCategoryGap="8%">
                  <CartesianGrid vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="month" tickFormatter={v => MONTHS_SHORT[v - 1]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={barTooltip} />
                  <Legend wrapperStyle={{ fontSize: '0.74rem', paddingTop: 6 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} label={<BarLabel />} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} label={<BarLabel />} />
                </BarChart>
              </ResponsiveContainer>
              {/* Net P&L strip aligned with bars */}
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
              <span style={{ fontSize: '0.74rem' }}>Revenue from Pathao · expenses from Transactions tab</span>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Expenses This Month" sub={`By category · ${currentMonthName}`}>
          {expenseBreakdown.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
              No expenses logged this month
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 240, overflowY: 'auto' }}>
              {expenseBreakdown.map(item => {
                const pct = m.expenses > 0 ? (item.value / m.expenses) * 100 : 0;
                return (
                  <div key={item.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{item.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{fmt(item.value)}</span>
                      </div>
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

    </div>
  );
};
