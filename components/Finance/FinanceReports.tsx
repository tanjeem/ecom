'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle, Download, Truck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import type { PLData } from '@/lib/types/finance';
import { fmt, fmtFull, MONTHS_FULL, MONTHS_SHORT, inputStyle, selectStyle } from './shared';

const PLRow = ({ label, value, indent = false, bold = false, separator = false, color }: {
  label: string; value: number | null; indent?: boolean; bold?: boolean; separator?: boolean; color?: string;
}) => (
  <>
    {separator && <div style={{ borderBottom: '1px solid #e2e7ee', margin: '2px 0' }} />}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `6px 0 6px ${indent ? '18px' : '0'}`, gap: 8 }}>
      <span style={{ fontSize: bold ? '0.85rem' : '0.82rem', fontWeight: bold ? 800 : 500, color: color || (bold ? '#0f172a' : '#374151'), minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: bold ? '0.88rem' : '0.82rem', fontWeight: bold ? 800 : 500, color: color || (bold ? '#0f172a' : '#374151'), whiteSpace: 'nowrap', flexShrink: 0 }}>
        {value !== null ? fmtFull(value) : '—'}
      </span>
    </div>
  </>
);

const SectionHeader = ({ label }: { label: string }) => (
  <div style={{ padding: '12px 0 4px', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '2px solid #0f172a', marginTop: 4 }}>
    {label}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{MONTHS_SHORT[(label as number) - 1]}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: {fmt(p.value)}</div>
      ))}
    </div>
  );
};

interface PathaoMonthly {
  deliveredAmount: number;
  deliveredCount: number;
  inProcess: number;
  inReview: number;
  preparingInvoice: number;
  paymentSent: number;
  lastInvoiceDate: string | null;
}

export const FinanceReports: React.FC = () => {
  const [pl, setPl] = useState<PLData | null>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathaoMonthly, setPathaoMonthly] = useState<PathaoMonthly | null>(null);
  const [pathaoMonths, setPathaoMonths] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build date range matching the selected period
      const dateFrom = period === 'month'
        ? `${year}-${String(month).padStart(2, '0')}-01`
        : `${year}-01-01`;
      const dateTo = period === 'month'
        ? new Date(year, month, 0).toISOString().slice(0, 10)
        : `${year}-12-31`;

      const params = new URLSearchParams({ period, year: String(year), month: String(month) });
      const [plRes, pathaoRes, pathaoMonthsRes] = await Promise.allSettled([
        fetch(`/api/finance/reports?${params}`).then(r => r.json()),
        fetch(`/api/pathao/metrics?from=${dateFrom}&to=${dateTo}`).then(r => r.json()),
        fetch('/api/pathao/monthly').then(r => r.json()),
      ]);

      if (plRes.status === 'rejected') throw new Error(String(plRes.reason));
      const plJson = plRes.value;
      if (plJson.error) throw new Error(plJson.error);
      setPl(plJson.pl);
      setTrend(plJson.trend || []);

      if (pathaoRes.status === 'fulfilled') {
        const pj = pathaoRes.value;
        setPathaoMonthly({
          deliveredAmount: pj.orderSummary?.delivered?.amount ?? 0,
          deliveredCount:  pj.orderSummary?.delivered?.count ?? 0,
          inProcess:       pj.invoiceSummary?.paymentInProcess ?? 0,
          inReview:        pj.invoiceSummary?.paymentInReview ?? 0,
          preparingInvoice: pj.invoiceSummary?.paymentPreparingForInvoice ?? 0,
          paymentSent:     pj.invoiceSummary?.paymentSent ?? 0,
          lastInvoiceDate: pj.invoiceSummary?.lastInvoiceDate ?? null,
        });
      }

      if (pathaoMonthsRes.status === 'fulfilled') {
        const j = pathaoMonthsRes.value;
        if (j.months) setPathaoMonths(j.months);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [period, year, month]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Merge Pathao delivered revenue into P&L numbers
  const effectivePl = pl ? (() => {
    const pathaoRev = pathaoMonthly?.deliveredAmount ?? pl.revenue.pathao_payout;
    const totalRev = pathaoRev + pl.revenue.sales_prepaid + pl.revenue.sales_cod + pl.revenue.other_income;
    const grossProfit = totalRev - pl.cogs.total;
    const netProfit = grossProfit - pl.opex.total;
    return {
      ...pl,
      revenue: { ...pl.revenue, pathao_payout: pathaoRev, total: totalRev },
      gross_profit: grossProfit,
      gross_margin: totalRev > 0 ? (grossProfit / totalRev) * 100 : 0,
      net_profit: netProfit,
      net_margin: totalRev > 0 ? (netProfit / totalRev) * 100 : 0,
    };
  })() : null;

  // Merge Pathao delivered revenue into trend for the yearly chart
  const mergedTrend = trend.map(t => {
    const monthKey = `${year}-${String(t.month).padStart(2, '0')}`;
    const pathaoM = pathaoMonths.find(pm => pm.month === monthKey);
    // Use Pathao delivered COD value. If 0 or absent, fallback to manual ledger revenue
    const revenue = pathaoM ? pathaoM.delivered : t.revenue;
    return { month: t.month, revenue, expenses: t.expenses, profit: revenue - t.expenses };
  });
  const trendHasData = mergedTrend.some(t => t.revenue > 0 || t.expenses > 0);

  const downloadCSV = () => {
    if (!effectivePl) return;
    const ep = effectivePl;
    const rows = [
      ['Profit & Loss Statement', period === 'month' ? `${MONTHS_FULL[month - 1]} ${year}` : `Year ${year}`],
      [],
      ['REVENUE'],
      ['Pathao COD Payouts', ep.revenue.pathao_payout],
      ['Prepaid Sales (bKash / Cash)', ep.revenue.sales_prepaid],
      ['Other COD / Direct', ep.revenue.sales_cod],
      ['Other Income', ep.revenue.other_income],
      ['Total Revenue', ep.revenue.total],
      [],
      ['COST OF GOODS SOLD'],
      ['Fabric', ep.cogs.fabric],
      ['Accessories', ep.cogs.accessories],
      ['Sewing / Production', ep.cogs.sewing],
      ['Packaging Materials', ep.cogs.packaging_material],
      ['Total COGS', ep.cogs.total],
      [],
      ['Gross Profit', ep.gross_profit],
      ['Gross Margin', `${ep.gross_margin.toFixed(2)}%`],
      [],
      ['OPERATING EXPENSES'],
      ['Rent', ep.opex.rent],
      ['Salary', ep.opex.salary],
      ['Transport', ep.opex.transport],
      ['Meta Ads', ep.opex.ads_meta],
      ['Google Ads', ep.opex.ads_google],
      ['Photoshoot', ep.opex.photoshoot],
      ['Miscellaneous', ep.opex.miscellaneous],
      ['Total OPEX', ep.opex.total],
      [],
      ['Net Profit', ep.net_profit],
      ['Net Margin', `${ep.net_margin.toFixed(2)}%`],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pl-${period === 'month' ? `${year}-${String(month).padStart(2, '0')}` : year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div className="segmented-control" style={{ background: '#f1f5f9' }}>
          <button className={period === 'month' ? 'is-selected' : ''} onClick={() => setPeriod('month')} style={{ fontSize: '0.82rem' }}>Monthly</button>
          <button className={period === 'year' ? 'is-selected' : ''} onClick={() => setPeriod('year')} style={{ fontSize: '0.82rem' }}>Yearly</button>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...selectStyle, width: 100 }}>
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {period === 'month' && (
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ ...selectStyle, width: 140 }}>
            {MONTHS_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}
        <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e7ee', borderRadius: 7, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
          <RefreshCw size={13} /> Refresh
        </button>
        {effectivePl && (
          <button onClick={downloadCSV} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e7ee', borderRadius: 7, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: 10, color: '#64748b', background: '#fff', borderRadius: 10, border: '1px solid #e2e7ee' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.9rem' }}>Generating report...</span>
        </div>
      ) : error ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e7ee' }}>
          <AlertCircle size={24} color="#dc2626" style={{ marginBottom: 10 }} />
          <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '0 0 8px' }}>{error}</p>
          <p style={{ color: '#64748b', fontSize: '0.78rem', margin: 0 }}>Make sure the Supabase migration has been run.</p>
        </div>
      ) : !effectivePl ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pathao panel */}
          {pathaoMonthly && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Truck size={15} color="#0891b2" />
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0c4a6e' }}>
                  Pathao — {period === 'month' ? MONTHS_FULL[month - 1] : `FY ${year}`}
                </span>
                {pathaoMonthly.lastInvoiceDate && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#64748b' }}>
                    Last paid: {pathaoMonthly.lastInvoiceDate}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, auto)', gap: 12, alignItems: 'center' }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      Delivered COD — {period === 'month' ? MONTHS_FULL[month - 1] : `FY ${year}`}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a' }}>{fmt(pathaoMonthly.deliveredAmount)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Orders</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>{pathaoMonthly.deliveredCount}</div>
                  </div>
                </div>
                {[
                  { label: 'Payment Sent', value: pathaoMonthly.paymentSent, color: '#16a34a' },
                  { label: 'In Process', value: pathaoMonthly.inProcess, color: '#d97706' },
                  { label: 'In Review', value: pathaoMonthly.inReview, color: '#7c3aed' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#fff', borderRadius: 7, padding: '12px 14px', minWidth: 110 }}>
                    <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: item.color }}>{fmt(item.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Revenue', value: fmt(effectivePl.revenue.total), color: '#16a34a' },
              { label: 'Total COGS', value: fmt(effectivePl.cogs.total), color: '#7c3aed' },
              { label: 'Gross Profit', value: `${fmt(effectivePl.gross_profit)} (${effectivePl.gross_margin.toFixed(1)}%)`, color: effectivePl.gross_profit >= 0 ? '#2563eb' : '#dc2626' },
              { label: 'Net Profit', value: `${fmt(effectivePl.net_profit)} (${effectivePl.net_margin.toFixed(1)}%)`, color: effectivePl.net_profit >= 0 ? '#16a34a' : '#dc2626' },
            ].map(item => (
              <div key={item.label} style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* P&L table + charts side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>

            {/* P&L Statement */}
            <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '20px 22px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.63rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ThreadOps</div>
                <h2 style={{ margin: '2px 0 0', fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>
                  P&L — {period === 'month' ? `${MONTHS_FULL[month - 1]} ${year}` : `FY ${year}`}
                </h2>
              </div>
              <div>
                <SectionHeader label="Revenue" />
                <PLRow label={`Pathao COD${pathaoMonthly ? ` (${pathaoMonthly.deliveredCount})` : ''}`} value={effectivePl.revenue.pathao_payout} indent />
                <PLRow label="Prepaid / bKash / Cash" value={effectivePl.revenue.sales_prepaid} indent />
                <PLRow label="Other COD / Direct" value={effectivePl.revenue.sales_cod} indent />
                <PLRow label="Other Income" value={effectivePl.revenue.other_income} indent />
                <PLRow label="Total Revenue" value={effectivePl.revenue.total} bold separator />

                <SectionHeader label="COGS" />
                <PLRow label="Fabric" value={effectivePl.cogs.fabric} indent />
                <PLRow label="Accessories" value={effectivePl.cogs.accessories} indent />
                <PLRow label="Sewing / Production" value={effectivePl.cogs.sewing} indent />
                <PLRow label="Packaging" value={effectivePl.cogs.packaging_material} indent />
                <PLRow label="Total COGS" value={effectivePl.cogs.total} bold separator />

                <SectionHeader label="Gross Profit" />
                <PLRow label={`${effectivePl.gross_margin.toFixed(1)}% margin`} value={effectivePl.gross_profit} bold color={effectivePl.gross_profit >= 0 ? '#16a34a' : '#dc2626'} />

                <SectionHeader label="OPEX" />
                <PLRow label="Rent" value={effectivePl.opex.rent} indent />
                <PLRow label="Salaries" value={effectivePl.opex.salary} indent />
                <PLRow label="Transport" value={effectivePl.opex.transport} indent />
                <PLRow label="Meta Ads" value={effectivePl.opex.ads_meta} indent />
                <PLRow label="Google Ads" value={effectivePl.opex.ads_google} indent />
                <PLRow label="Photoshoot" value={effectivePl.opex.photoshoot} indent />
                <PLRow label="Miscellaneous" value={effectivePl.opex.miscellaneous} indent />
                <PLRow label="Total OPEX" value={effectivePl.opex.total} bold separator />

                <SectionHeader label="Net Profit" />
                <PLRow label={`${effectivePl.net_margin.toFixed(1)}% margin`} value={effectivePl.net_profit} bold color={effectivePl.net_profit >= 0 ? '#16a34a' : '#dc2626'} />
              </div>
            </div>

            {/* Charts + breakdowns */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 800 }}>Monthly Trend — {year}</h3>
                {trendHasData ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={mergedTrend} barGap={2} barCategoryGap="30%">
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tickFormatter={v => MONTHS_SHORT[v - 1]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="profit" name="Net Profit" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 210, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 6 }}>
                    <span style={{ fontSize: '1.4rem' }}>📊</span>
                    <span style={{ fontSize: '0.83rem' }}>No transactions logged for {year}</span>
                    <span style={{ fontSize: '0.74rem' }}>Add expenses in Transactions to populate the chart</span>
                  </div>
                )}
              </div>

              {/* Revenue Waterfall */}
              {(() => {
                const ep = effectivePl;
                const netPos = Math.max(0, ep.net_profit);
                const waterfallData = [
                  { name: 'Revenue',      spacer: 0,                value: ep.revenue.total,   fill: '#16a34a' },
                  { name: '− COGS',       spacer: ep.gross_profit >= 0 ? ep.gross_profit : 0,  value: ep.cogs.total,      fill: '#dc2626' },
                  { name: 'Gross Profit', spacer: 0,                value: Math.max(0, ep.gross_profit), fill: '#2563eb' },
                  { name: '− OPEX',       spacer: netPos,           value: ep.opex.total,      fill: '#f97316' },
                  { name: 'Net Profit',   spacer: 0,                value: netPos,             fill: ep.net_profit >= 0 ? '#16a34a' : '#dc2626' },
                ];
                const hasData = ep.revenue.total > 0;
                return (
                  <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 800 }}>Revenue Waterfall</h3>
                    {hasData ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={waterfallData} barCategoryGap="30%">
                          <CartesianGrid vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(v: any, name: any) => name === 'spacer' ? ['', ''] : [`৳${Number(v).toLocaleString()}`, name as string]} contentStyle={{ fontSize: '0.78rem', borderRadius: 8, border: '1px solid #e2e7ee' }} />
                          <Bar dataKey="spacer" stackId="a" fill="transparent" />
                          <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
                            {waterfallData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 6 }}>
                        <span style={{ fontSize: '1.4rem' }}>📊</span>
                        <span style={{ fontSize: '0.83rem' }}>No data for this period</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { title: 'COGS Breakdown', entries: effectivePl.cogs, total: effectivePl.cogs.total, color: '#7c3aed' },
                  { title: 'OPEX Breakdown', entries: effectivePl.opex, total: effectivePl.opex.total, color: '#dc2626' },
                ].map(({ title, entries, total, color }) => (
                  <div key={title} style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '16px 18px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{title}</h4>
                    {Object.entries(entries).filter(([k, v]) => k !== 'total' && (v as number) > 0).length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0 }}>Nothing logged yet</p>
                    ) : Object.entries(entries).filter(([k]) => k !== 'total').map(([cat, val]) => {
                      if ((val as number) === 0) return null;
                      const pct = total > 0 ? ((val as number) / total * 100) : 0;
                      return (
                        <div key={cat} style={{ marginBottom: 7 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
                            <span style={{ color: '#374151' }}>{cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            <span style={{ fontWeight: 700 }}>{fmt(val as number)}</span>
                          </div>
                          <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
