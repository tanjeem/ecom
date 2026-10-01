'use client';

import React, { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, Percent, Package, RotateCcw, Megaphone, Clock, Lightbulb,
  AlertTriangle, CheckCircle2, Info, ArrowRight, Truck, Landmark,
} from 'lucide-react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { COST_GROUPS, type FinanceSummary, type SeriesPoint } from '@/lib/finance/types';
import { todayISO, type Granularity, type PeriodMode } from '@/lib/finance/periods';
import { fmt, fmtCompact, fmtPct, CHART, getCategoryLabel } from './shared';
import { Card, KpiCard, LoadingState, ErrorState, Segmented, pctChange, Delta } from './ui';
import { usePeriod, useFinanceSummary, GranularityToggle } from './period';

// ─── chart helpers ────────────────────────────────────────────────────────────

const axisProps = { tick: { fontSize: 11, fill: CHART.axis }, axisLine: false, tickLine: false } as const;

const ChartTooltip = ({ active, payload, label, extra }: any) => {
  if (!active || !payload?.length) return null;
  const row: SeriesPoint | undefined = payload[0]?.payload;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '9px 12px', fontSize: '0.76rem', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', minWidth: 180 }}>
      <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{row?.from && row.to && row.from !== row.to ? `${label} · ${row.from.slice(5)} → ${row.to.slice(5)}` : label}</div>
      {payload.filter((p: any) => p.value != null).map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3, color: '#334155' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.stroke || p.fill }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>{fmt(Number(p.value))}</span>
        </div>
      ))}
      {extra?.(row)}
      <div style={{ marginTop: 6, color: '#94a3b8', fontSize: '0.68rem' }}>Click to drill into this period</div>
    </div>
  );
};

const GRAN_TO_MODE: Record<Granularity, PeriodMode> = { day: 'day', week: 'week', month: 'month', quarter: 'quarter', year: 'year' };

// ─── insights ─────────────────────────────────────────────────────────────────

type Insight = { tone: 'good' | 'warn' | 'bad' | 'info'; text: React.ReactNode };

function buildInsights(cur: FinanceSummary, prev: FinanceSummary | null, compareText: string, isCurrent: boolean): Insight[] {
  const out: Insight[] = [];
  const { pl, orders, range } = cur;
  const elapsed = Math.max(range.elapsedDays, 1);

  // Revenue momentum
  if (prev) {
    const d = pctChange(pl.revenue.total, prev.pl.revenue.total);
    if (d != null && Math.abs(d) >= 5) {
      out.push({ tone: d > 0 ? 'good' : 'warn', text: <>Revenue is <b>{d > 0 ? 'up' : 'down'} {Math.abs(d).toFixed(0)}%</b> {compareText} ({fmt(prev.pl.revenue.total)} → {fmt(pl.revenue.total)}).</> });
    }
  }

  // Profitability & break-even
  if (pl.revenue.total > 0 || pl.expenses > 0) {
    if (pl.net_profit >= 0) {
      out.push({ tone: 'good', text: <>Profitable: keeping <b>{fmtPct(pl.net_margin)}</b> of revenue as net profit ({fmt(pl.net_profit)}).</> });
    } else {
      const dailyNeeded = pl.expenses / elapsed;
      const dailyActual = pl.revenue.total / elapsed;
      out.push({ tone: 'bad', text: <>Running at a <b>{fmt(-pl.net_profit)} loss</b>. Break-even needs ~<b>{fmt(dailyNeeded)}/day</b> revenue vs {fmt(dailyActual)}/day now.</> });
    }
  }

  // Run-rate projection for an in-progress period
  // Needs a few days of data before a projection means anything
  if (isCurrent && range.elapsedDays >= 3 && range.elapsedDays < range.days) {
    const factor = range.days / range.elapsedDays;
    const projRev = pl.revenue.total * factor;
    // Fixed costs already accrue daily, so scaling all expenses is a fair estimate
    const projNet = projRev - pl.expenses * factor;
    out.push({ tone: projNet >= 0 ? 'info' : 'warn', text: <>At the current pace this period ends near <b>{fmt(projRev)}</b> revenue and <b>{fmt(projNet)}</b> net ({range.elapsedDays} of {range.days} days in).</> });
  }

  // Biggest cost mover
  if (prev) {
    const prevMap = new Map(prev.topCategories.map(c => [c.category, c.amount]));
    let best: { cat: string; diff: number } | null = null;
    for (const c of cur.topCategories) {
      const diff = c.amount - (prevMap.get(c.category) || 0);
      if (!best || diff > best.diff) best = { cat: c.category, diff };
    }
    if (best && best.diff > Math.max(1000, pl.expenses * 0.05)) {
      out.push({ tone: 'warn', text: <><b>{catName(best.cat)}</b> rose by {fmt(best.diff)} {compareText} — the biggest cost increase.</> });
    }
  }

  // Margins — with no production costs logged, gross margin is meaningless
  if (pl.revenue.total > 0 && pl.cogs.total === 0) {
    out.push({ tone: 'warn', text: <>No production costs (fabric, sewing, accessories) are logged for this period, so <b>gross margin and profit are overstated</b>. Log them in Transactions or Procurement.</> });
  } else if (pl.revenue.total > 0 && pl.gross_margin < 40) {
    out.push({ tone: 'warn', text: <>Gross margin is <b>{fmtPct(pl.gross_margin)}</b> — below a healthy 40%+ for apparel. Check production costs or pricing.</> });
  }

  // Marketing efficiency
  const ads = pl.opex.ads_meta + pl.opex.ads_google;
  if (ads > 0 && pl.revenue.total > 0) {
    const mer = pl.revenue.total / ads;
    out.push({
      tone: mer >= 4 ? 'good' : mer >= 2.5 ? 'info' : 'bad',
      text: <>Every ৳1 on ads brings back <b>৳{mer.toFixed(2)}</b> in revenue (MER){mer >= 4 ? ' — room to scale spend.' : mer < 2.5 ? ' — review campaigns.' : '.'}</>,
    });
  }

  // Returns
  if (orders.delivered.count + orders.returned.count >= 10 && orders.returnRate >= 20) {
    out.push({ tone: 'bad', text: <>Return rate is <b>{fmtPct(orders.returnRate)}</b> ({orders.returned.count} orders). Each return costs courier fees with no revenue.</> });
  }

  return out.slice(0, 6);
}

const catName = (c: string) => (c === 'courier_fees' ? 'Pathao fees' : getCategoryLabel(c));

const INSIGHT_STYLE: Record<Insight['tone'], { icon: React.FC<any>; color: string; bg: string }> = {
  good: { icon: CheckCircle2, color: '#15803d', bg: '#f0fdf4' },
  warn: { icon: AlertTriangle, color: '#b45309', bg: '#fffbeb' },
  bad: { icon: TrendingDown, color: '#b91c1c', bg: '#fef2f2' },
  info: { icon: Info, color: '#1d4ed8', bg: '#eff6ff' },
};

// ─── main ─────────────────────────────────────────────────────────────────────

type ChartView = 'pnl' | 'costs' | 'cumulative';

export const FinanceOverview: React.FC<{ onOpenTab?: (tab: string) => void }> = ({ onOpenTab }) => {
  const period = usePeriod();
  const { range, compareRange, chartGranularity, compareText, isCurrent } = period;
  const cur = useFinanceSummary(range, chartGranularity, { invoice: true });
  const prev = useFinanceSummary(compareRange, chartGranularity);
  const [view, setView] = useState<ChartView>('pnl');

  const data = cur.data;
  const p = prev.data;

  const cumulative = useMemo(() => {
    if (!data) return [];
    let a = 0;
    let b = 0;
    const today = todayISO();
    return data.series.map((s, i) => {
      a += s.net;
      const ps = p?.series[i];
      if (ps) b += ps.net;
      return { ...s, cumNet: s.from > today ? null : a, cumPrev: ps ? b : null };
    });
  }, [data, p]);

  if (!data && cur.loading) return <LoadingState label="Crunching the numbers…" />;
  if (!data && cur.error) return <ErrorState message="Could not load finance data" hint={cur.error} onRetry={cur.reload} />;
  if (!data) return null;

  const { pl, orders } = data;
  // Buckets that haven't started yet are blanked so lines stop at today instead of dropping to zero
  const today = todayISO();
  const series = data.series.map(s => (s.from > today
    ? { ...s, revenue: null as unknown as number, expenses: null as unknown as number, net: null as unknown as number, delivered: null as unknown as number }
    : s));
  const pastSeries = data.series.filter(s => s.from <= today);
  const closed = orders.delivered.count + orders.returned.count;
  const pClosed = p ? p.orders.delivered.count + p.orders.returned.count : 0;
  const ads = pl.opex.ads_meta + pl.opex.ads_google;
  const pAds = p ? p.pl.opex.ads_meta + p.pl.opex.ads_google : null;
  const mer = ads > 0 ? pl.revenue.total / ads : null;
  const insights = buildInsights(data, p, compareText, isCurrent);
  const groupTotal = Object.values(pl.groups).reduce((s, v) => s + v, 0);
  const hasSeries = pastSeries.some(s => s.revenue || s.expenses);
  const cmp = (v: number | undefined | null) => (p && v != null ? fmt(v) : undefined);

  const drill = (row: SeriesPoint) => {
    if (series.length <= 1) return;
    period.setMode(GRAN_TO_MODE[data.granularity]);
    period.setAnchor(row.key);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: cur.loading ? 0.65 : 1, transition: 'opacity 150ms ease' }}>
      {cur.loading && <div className="fin-loading-bar" style={{ marginTop: -10 }} />}

      {data.warnings.length > 0 && (
        <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: '0.78rem', color: '#92400e' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>{data.warnings.join(' ')}</div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <KpiCard label="Revenue" icon={TrendingUp} value={fmt(pl.revenue.total)}
          delta={p ? pctChange(pl.revenue.total, p.pl.revenue.total) : undefined} compareValue={cmp(p?.pl.revenue.total)}
          sub={compareText || `${orders.delivered.count} delivered orders`}
          spark={pastSeries.map(s => s.revenue)} sparkColor={CHART.revenue}
          onClick={() => onOpenTab?.('reports')} />
        <KpiCard label="Total costs" icon={Wallet} value={fmt(pl.expenses)}
          delta={p ? pctChange(pl.expenses, p.pl.expenses) : undefined} deltaGoodWhen="down" compareValue={cmp(p?.pl.expenses)}
          sub="COGS + operating + ads"
          spark={pastSeries.map(s => s.expenses)} sparkColor={CHART.expenses}
          onClick={() => onOpenTab?.('transactions')} />
        <KpiCard label="Net profit" icon={pl.net_profit >= 0 ? TrendingUp : TrendingDown} value={fmt(pl.net_profit)}
          tone={pl.net_profit >= 0 ? 'good' : 'bad'}
          delta={p ? pctChange(pl.net_profit, p.pl.net_profit) : undefined} compareValue={cmp(p?.pl.net_profit)}
          sub={`${fmtPct(pl.net_margin)} net margin`}
          spark={pastSeries.map(s => s.net)} sparkColor={CHART.net} />
        <KpiCard label="Gross margin" icon={Percent} value={pl.revenue.total ? fmtPct(pl.gross_margin) : '—'}
          tone={pl.revenue.total === 0 || pl.cogs.total === 0 ? undefined : pl.gross_margin >= 45 ? 'good' : pl.gross_margin >= 35 ? 'warn' : 'bad'}
          delta={p && p.pl.revenue.total && pl.revenue.total ? pl.gross_margin - p.pl.gross_margin : undefined} deltaPoints
          sub={pl.revenue.total > 0 && pl.cogs.total === 0 ? 'No production costs logged' : `Gross profit ${fmt(pl.gross_profit)}`} />
        <KpiCard label="Invoiced deliveries" icon={Package} value={orders.delivered.count.toLocaleString()}
          delta={p ? pctChange(orders.delivered.count, p.orders.delivered.count) : undefined}
          sub={orders.aov ? `AOV ${fmt(orders.aov)}` : 'No deliveries yet'}
          spark={pastSeries.map(s => s.delivered)} sparkColor={CHART.revenue} />
        <KpiCard label="Return rate" icon={RotateCcw}
          value={closed ? fmtPct(orders.returnRate) : '—'}
          tone={closed === 0 ? undefined : orders.returnRate < 15 ? 'good' : orders.returnRate < 25 ? 'warn' : 'bad'}
          delta={p && pClosed && closed ? orders.returnRate - p.orders.returnRate : undefined}
          deltaGoodWhen="down" deltaPoints
          sub={`${orders.returned.count} returned`} />
        <KpiCard label="Ad spend" icon={Megaphone} value={fmt(ads)}
          delta={p ? pctChange(ads, pAds) : undefined} deltaGoodWhen="neutral" compareValue={cmp(pAds)}
          sub={mer ? `MER ${mer.toFixed(1)}× · ${data.sources.meta === 'api' ? 'Meta API' : 'logged'}` : data.sources.meta === 'api' ? 'Meta API' : 'From logged entries'}
          onClick={() => onOpenTab?.('ads')} />
        <KpiCard label="Pathao holding" icon={Clock} value={data.invoice ? fmt(data.invoice.inTransit) : '—'}
          sub={data.invoice?.lastInvoiceDate ? `Last payout ${data.invoice.lastInvoiceDate}` : 'Cash awaiting payout (live)'} />
      </div>

      {/* Main chart + insights */}
      <div className="fin-grid-main">
        <Card
          title={view === 'pnl' ? 'Revenue, costs & profit' : view === 'costs' ? 'Where the money goes' : 'Cumulative net profit'}
          subtitle={view === 'cumulative' && p ? `Running total, ${compareText}` : `${period.label} · fixed costs accrued daily`}
          action={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Segmented size="sm" value={view} onChange={setView} options={[
                { id: 'pnl', label: 'P&L' }, { id: 'costs', label: 'Costs' }, { id: 'cumulative', label: 'Cumulative' },
              ]} />
              <GranularityToggle />
            </div>
          }
        >
          {!hasSeries ? (
            <div style={{ height: 280, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: '0.83rem', textAlign: 'center' }}>
              <div>No revenue or costs recorded for {period.label}.<br /><span style={{ fontSize: '0.75rem' }}>Try a wider range, or log transactions.</span></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              {view === 'pnl' ? (
                <ComposedChart data={series} barGap={2} barCategoryGap={series.length > 20 ? '18%' : '28%'} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={12} />
                  <YAxis {...axisProps} width={56} tickFormatter={fmtCompact} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                  <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: '0.74rem', paddingTop: 6 }} />
                  <Bar dataKey="revenue" name="Revenue" fill={CHART.revenue} radius={[4, 4, 0, 0]} maxBarSize={36} onClick={(d: any) => drill(d.payload ?? d)} style={{ cursor: 'pointer' }} />
                  <Bar dataKey="expenses" name="Costs" fill={CHART.expenses} radius={[4, 4, 0, 0]} maxBarSize={36} onClick={(d: any) => drill(d.payload ?? d)} style={{ cursor: 'pointer' }} />
                  <Line dataKey="net" name="Net profit" stroke={CHART.net} strokeWidth={2} dot={series.length <= 31 ? { r: 3, strokeWidth: 0, fill: CHART.net } : false} activeDot={{ r: 5 }} type="linear" />
                </ComposedChart>
              ) : view === 'costs' ? (
                <BarChart data={series} barCategoryGap={series.length > 20 ? '18%' : '30%'} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={12} />
                  <YAxis {...axisProps} width={56} tickFormatter={fmtCompact} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                  <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: '0.74rem', paddingTop: 6 }} />
                  {COST_GROUPS.map((g, i) => (
                    <Bar key={g.key} dataKey={`groups.${g.key}`} name={g.label} stackId="c" fill={CHART.groups[g.key]}
                      stroke="#fff" strokeWidth={1} maxBarSize={36}
                      radius={i === COST_GROUPS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      onClick={(d: any) => drill(d.payload ?? d)} style={{ cursor: 'pointer' }} />
                  ))}
                </BarChart>
              ) : (
                <ComposedChart data={cumulative} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={12} />
                  <YAxis {...axisProps} width={56} tickFormatter={fmtCompact} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: '0.74rem', paddingTop: 6 }} />
                  {p && <Line dataKey="cumPrev" name={`Comparison (${compareText.replace(/^vs /, '')})`} stroke={CHART.compare} strokeWidth={2} dot={false} type="monotone" connectNulls />}
                  <Line dataKey="cumNet" name="This period" stroke={CHART.revenue} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} type="monotone" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          )}
        </Card>

        <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lightbulb size={15} color="#b45309" /> Insights</span>} subtitle="Generated from this period's numbers">
          {insights.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Not enough activity in this period to say anything useful yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map((ins, i) => {
                const s = INSIGHT_STYLE[ins.tone];
                const Icon = s.icon;
                return (
                  <div key={i} style={{ display: 'flex', gap: 9, padding: '9px 11px', background: s.bg, borderRadius: 9, fontSize: '0.78rem', lineHeight: 1.45, color: '#1e293b' }}>
                    <Icon size={15} color={s.color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>{ins.text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Cost mix / orders / cash */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Card title="Cost mix" subtitle={`${fmt(pl.expenses)} total${p ? ` · change ${compareText}` : ''}`}>
          {groupTotal === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No costs in this period.</p>
          ) : (
            <>
              {/* Part-to-whole strip: one bar, labelled list below carries the values */}
              <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
                {COST_GROUPS.filter(g => pl.groups[g.key] > 0).map(g => (
                  <div key={g.key} title={`${g.label}: ${fmt(pl.groups[g.key])}`} style={{ flex: pl.groups[g.key], background: CHART.groups[g.key] }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {COST_GROUPS.map(g => {
                  const v = pl.groups[g.key];
                  const pv = p?.pl.groups[g.key];
                  return (
                    <div key={g.key} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto auto', alignItems: 'center', gap: 9, fontSize: '0.79rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART.groups[g.key] }} />
                      <span style={{ color: '#334155' }}>{g.label} <span style={{ color: '#94a3b8' }}>{groupTotal ? `${((v / groupTotal) * 100).toFixed(0)}%` : ''}</span></span>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</span>
                      {p ? <Delta value={pctChange(v, pv)} goodWhen="down" /> : <span />}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <Card title="Order health" subtitle="Invoiced by Pathao in this period · in progress is live" action={
          onOpenTab && <button type="button" onClick={() => onOpenTab('ads')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>Ads <ArrowRight size={12} /></button>
        }>
          {!data.sources.pathao ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No Pathao invoice data — run scripts/sync-pathao-invoices.mjs.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Delivered', count: orders.delivered.count, amount: orders.delivered.amount, color: '#15803d' },
                { label: 'In progress (live)', count: orders.inProcess.count, amount: orders.inProcess.amount, color: '#1d4ed8' },
                { label: 'Returned', count: orders.returned.count, amount: orders.returned.amount, color: '#b91c1c' },
              ].map(r => {
                const total = orders.delivered.count + orders.inProcess.count + orders.returned.count;
                return (
                  <div key={r.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.79rem', marginBottom: 4 }}>
                      <span style={{ color: '#334155' }}><b style={{ color: r.color }}>{r.count}</b> {r.label.toLowerCase()}</span>
                      <span style={{ color: '#0f172a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.amount)}</span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99 }}>
                      <div style={{ height: '100%', width: `${total ? (r.count / total) * 100 : 0}%`, background: r.color, borderRadius: 99, opacity: 0.75 }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 9, marginTop: 2, fontSize: '0.78rem', color: '#64748b' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Truck size={13} /> Pathao fees</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(orders.courierFees)}{orders.delivered.amount ? <span style={{ color: '#94a3b8', fontWeight: 500 }}> · {((orders.courierFees / orders.delivered.amount) * 100).toFixed(1)}% of collected</span> : null}</span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Cash movement" subtitle="Recorded money in & out, by method">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'In', v: data.cash.inflow, c: '#15803d' },
              { label: 'Out', v: data.cash.outflow, c: '#b91c1c' },
              { label: 'Net', v: data.cash.net, c: data.cash.net >= 0 ? '#0f172a' : '#b91c1c' },
            ].map(x => (
              <div key={x.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{x.label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: x.c, fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(x.v)}</div>
              </div>
            ))}
          </div>
          {data.cash.byMethod.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>No transactions recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.cash.byMethod.slice(0, 5).map(m => (
                <div key={m.method} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: '0.78rem' }}>
                  <span style={{ color: '#334155' }}>{m.method}</span>
                  <span style={{ color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>+{fmtCompact(m.inflow)}</span>
                  <span style={{ color: '#b91c1c', fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>−{fmtCompact(m.outflow)}</span>
                </div>
              ))}
            </div>
          )}
          {(data.cash.pathaoPayouts > 0 || Object.keys(data.cash.transfers).length > 0) && (
            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 10, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.76rem', color: '#64748b' }}>
              {data.cash.pathaoPayouts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><Truck size={12} style={{ verticalAlign: -2 }} /> Pathao payouts (by invoice paid date)</span><b style={{ color: '#0f172a' }}>{fmt(data.cash.pathaoPayouts)}</b></div>
              )}
              {Object.entries(data.cash.transfers).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span><Landmark size={12} style={{ verticalAlign: -2 }} /> {getCategoryLabel(k)}</span><b style={{ color: '#0f172a' }}>{fmt(v)}</b></div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top cost lines + vendors */}
      <div className="fin-grid-2">
        <Card title="Biggest cost lines" subtitle={p ? `With change ${compareText}` : undefined}>
          {data.topCategories.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No costs in this period.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.topCategories.slice(0, 8).map(c => {
                const max = data.topCategories[0].amount || 1;
                const pv = p?.topCategories.find(x => x.category === c.category)?.amount ?? (p ? 0 : null);
                return (
                  <div key={c.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: '0.79rem', marginBottom: 4 }}>
                      <span style={{ color: '#334155' }}>{catName(c.category)}{c.count ? <span style={{ color: '#94a3b8' }}> · {c.count} entries</span> : null}</span>
                      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <b style={{ color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.amount)}</b>
                        {p && <Delta value={pctChange(c.amount, pv)} goodWhen="down" />}
                      </span>
                    </div>
                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99 }}>
                      <div style={{ height: '100%', width: `${(c.amount / max) * 100}%`, background: CHART.expenses, borderRadius: 99, opacity: 0.8 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Top vendors" subtitle="Spend logged against a vendor" action={
          onOpenTab && <button type="button" onClick={() => onOpenTab('vendors')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>All vendors <ArrowRight size={12} /></button>
        }>
          {data.topVendors.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No vendor-linked spend in this period.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
              <tbody>
                {data.topVendors.map((v, i) => (
                  <tr key={v.name} style={{ borderTop: i ? '1px solid #f1f5f9' : undefined }}>
                    <td style={{ padding: '7px 0', color: '#334155' }}>{v.name}</td>
                    <td style={{ padding: '7px 0', color: '#94a3b8', textAlign: 'right' }}>{v.count} payments</td>
                    <td style={{ padding: '7px 0', color: '#0f172a', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(v.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.5 }}>
        Pathao revenue follows paid Pathao invoices only: cash collected on invoiced deliveries, dated by invoice, with Pathao's invoiced fees as courier cost. Prepaid & direct sales come from the ledger.
        Meta spend {data.sources.meta === 'api' ? 'comes from the Meta API (USD × ৳130 + 15% VAT)' : 'comes from logged entries (Meta API not connected)'}.
        Fixed costs ({data.sources.fixedCosts}) accrue daily up to today.
      </p>
    </div>
  );
};
