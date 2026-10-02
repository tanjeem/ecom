'use client';

import React, { useMemo, useState } from 'react';
import { Download, Printer, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend, LabelList,
} from 'recharts';
import type { PLBreakdown, FinanceSummary } from '@/lib/finance/types';
import { plFromCats } from '@/lib/finance/pl';
import { periodLabel } from '@/lib/finance/periods';
import { fmt, fmtFull, fmtCompact, fmtPct, CHART, btnSecondary } from './shared';
import { Card, LoadingState, ErrorState, Delta, KpiCard, Segmented, pctChange } from './ui';
import { usePeriod, useFinanceSummary, GranularityToggle } from './period';

// ─── line definitions ─────────────────────────────────────────────────────────

type Kind = 'revenue' | 'cost' | 'profit' | 'pct';
type Line =
  | { section: string }
  | { label: string; get: (pl: PLBreakdown) => number; kind: Kind; indent?: boolean; total?: boolean; highlight?: boolean };

const LINES: Line[] = [
  { section: 'Revenue' },
  { label: 'Total revenue (Pathao collected)', get: pl => pl.revenue.total, kind: 'revenue', total: true },
  { section: 'Cost of goods sold' },
  { label: 'Product cost (units sold × unit cost)', get: pl => pl.cogs.product_cost, kind: 'cost', indent: true },
  { label: 'Fabric', get: pl => pl.cogs.fabric, kind: 'cost', indent: true },
  { label: 'Accessories', get: pl => pl.cogs.accessories, kind: 'cost', indent: true },
  { label: 'Sewing / production', get: pl => pl.cogs.sewing, kind: 'cost', indent: true },
  { label: 'Packaging', get: pl => pl.cogs.packaging_material, kind: 'cost', indent: true },
  { label: 'Total COGS', get: pl => pl.cogs.total, kind: 'cost', total: true },
  { label: 'Gross profit', get: pl => pl.gross_profit, kind: 'profit', highlight: true },
  { label: 'Gross margin', get: pl => pl.gross_margin, kind: 'pct' },
  { section: 'Operating expenses' },
  { label: 'Meta ads', get: pl => pl.opex.ads_meta, kind: 'cost', indent: true },
  { label: 'Google ads', get: pl => pl.opex.ads_google, kind: 'cost', indent: true },
  { label: 'Photoshoot', get: pl => pl.opex.photoshoot, kind: 'cost', indent: true },
  { label: 'Rent', get: pl => pl.opex.rent, kind: 'cost', indent: true },
  { label: 'Salaries', get: pl => pl.opex.salary, kind: 'cost', indent: true },
  { label: 'Pathao fees (invoiced)', get: pl => pl.opex.courier_fees, kind: 'cost', indent: true },
  { label: 'Transport', get: pl => pl.opex.transport, kind: 'cost', indent: true },
  { label: 'Miscellaneous', get: pl => pl.opex.miscellaneous, kind: 'cost', indent: true },
  { label: 'Total operating expenses', get: pl => pl.opex.total, kind: 'cost', total: true },
  { label: 'Operating profit', get: pl => pl.operating_profit, kind: 'profit' },
  { label: 'Other income (prepaid / direct, logged by hand)', get: pl => pl.other_income, kind: 'revenue', indent: true },
  { label: 'Net profit', get: pl => pl.net_profit, kind: 'profit', highlight: true },
  { label: 'Net margin', get: pl => pl.net_margin, kind: 'pct' },
];

const isSection = (l: Line): l is { section: string } => 'section' in l;
const fmtVal = (v: number, kind: Kind, full = false) => (kind === 'pct' ? fmtPct(v) : full ? fmtFull(v) : fmt(v));

function exportCSV(rows: (string | number)[][], filename: string) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── main ─────────────────────────────────────────────────────────────────────

export const FinanceReports: React.FC = () => {
  const period = usePeriod();
  const { range, compareRange, chartGranularity, compareText } = period;
  const cur = useFinanceSummary(range, chartGranularity);
  const prev = useFinanceSummary(compareRange, chartGranularity);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [view, setView] = useState<'statement' | 'breakdown'>('statement');

  const data = cur.data;
  const p = prev.data;

  const bucketPLs = useMemo(() => (data ? data.series.map(s => plFromCats(s.cats)) : []), [data]);

  const visibleLines = useMemo(() => {
    if (!data) return LINES;
    if (!hideEmpty) return LINES;
    return LINES.filter(l => isSection(l) || l.total || l.highlight || l.kind === 'pct' || l.get(data.pl) !== 0 || (p && l.get(p.pl) !== 0));
  }, [data, p, hideEmpty]);

  if (!data && cur.loading) return <LoadingState label="Building P&L…" />;
  if (!data && cur.error) return <ErrorState message="Could not build the report" hint={cur.error} onRetry={cur.reload} />;
  if (!data) return null;

  const pl = data.pl;
  const title = `Profit & Loss — ${period.label}`;
  const compareTitle = compareRange ? periodLabel('custom', compareRange) : null;

  const marginSeries = data.series.map((s, i) => ({
    label: s.label,
    gross: bucketPLs[i].revenue.total ? Number(bucketPLs[i].gross_margin.toFixed(1)) : null,
    net: bucketPLs[i].revenue.total ? Number(bucketPLs[i].net_margin.toFixed(1)) : null,
  }));

  const waterfall = (() => {
    const steps = [
      { name: 'Revenue', base: 0, value: pl.revenue.total, fill: CHART.revenue, shown: pl.revenue.total },
      { name: 'COGS', base: Math.max(pl.gross_profit, 0), value: Math.min(pl.cogs.total, pl.revenue.total), fill: CHART.expenses, shown: -pl.cogs.total },
      { name: 'Gross profit', base: 0, value: Math.max(pl.gross_profit, 0), fill: CHART.groups.overhead, shown: pl.gross_profit },
      { name: 'Operating', base: Math.max(pl.net_profit, 0), value: Math.max(Math.min(pl.opex.total, pl.gross_profit), 0), fill: CHART.expenses, shown: -pl.opex.total },
      { name: 'Net profit', base: 0, value: pl.net_profit, fill: pl.net_profit >= 0 ? CHART.revenue : '#b91c1c', shown: pl.net_profit },
    ];
    return steps;
  })();

  const downloadCSV = () => {
    const rows: (string | number)[][] = [[title], [`${range.from} to ${range.to}`], []];
    rows.push(['Line', 'This period', ...(p ? ['Comparison', 'Change %'] : []), '% of revenue']);
    for (const l of LINES) {
      if (isSection(l)) { rows.push([l.section.toUpperCase()]); continue; }
      const v = l.get(pl);
      const pv = p ? l.get(p.pl) : null;
      rows.push([
        l.label,
        l.kind === 'pct' ? `${v.toFixed(2)}%` : v.toFixed(2),
        ...(p ? [l.kind === 'pct' ? `${pv!.toFixed(2)}%` : pv!.toFixed(2), l.kind === 'pct' ? `${(v - pv!).toFixed(2)} pts` : (pctChange(v, pv)?.toFixed(1) ?? '')] : []),
        l.kind !== 'pct' && pl.revenue.total ? `${((v / pl.revenue.total) * 100).toFixed(1)}%` : '',
      ]);
    }
    if (data.series.length > 1) {
      rows.push([], ['BREAKDOWN BY PERIOD'], ['Line', ...data.series.map(s => `${s.from} – ${s.to}`), 'Total']);
      for (const l of LINES) {
        if (isSection(l)) continue;
        rows.push([l.label, ...bucketPLs.map(b => (l.kind === 'pct' ? `${l.get(b).toFixed(1)}%` : l.get(b).toFixed(2))), l.kind === 'pct' ? `${l.get(pl).toFixed(1)}%` : l.get(pl).toFixed(2)]);
      }
    }
    exportCSV(rows, `pnl-${range.from}_to_${range.to}.csv`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: cur.loading ? 0.65 : 1, transition: 'opacity 150ms ease' }}>
      {cur.loading && <div className="fin-loading-bar" style={{ marginTop: -10 }} />}

      {data.warnings.length > 0 && (
        <div role="status" className="fin-no-print" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: '0.78rem', color: '#92400e' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>{data.warnings.join(' ')}</div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KpiCard label="Revenue" value={fmt(pl.revenue.total)} delta={p ? pctChange(pl.revenue.total, p.pl.revenue.total) : undefined} sub={compareText} />
        <KpiCard label="COGS" value={fmt(pl.cogs.total)} delta={p ? pctChange(pl.cogs.total, p.pl.cogs.total) : undefined} deltaGoodWhen="down"
          sub={pl.revenue.total ? `${((pl.cogs.total / pl.revenue.total) * 100).toFixed(1)}% of revenue` : undefined} />
        <KpiCard label="Gross profit" value={fmt(pl.gross_profit)} tone={pl.gross_profit >= 0 ? undefined : 'bad'}
          delta={p ? pctChange(pl.gross_profit, p.pl.gross_profit) : undefined} sub={`${fmtPct(pl.gross_margin)} margin`} />
        <KpiCard label="Operating expenses" value={fmt(pl.opex.total)} delta={p ? pctChange(pl.opex.total, p.pl.opex.total) : undefined} deltaGoodWhen="down"
          sub={pl.revenue.total ? `${((pl.opex.total / pl.revenue.total) * 100).toFixed(1)}% of revenue` : undefined} />
        <KpiCard label="Net profit" value={fmt(pl.net_profit)} tone={pl.net_profit >= 0 ? 'good' : 'bad'}
          delta={p ? pctChange(pl.net_profit, p.pl.net_profit) : undefined} sub={`${fmtPct(pl.net_margin)} margin`} />
      </div>

      <div className="fin-grid-pl">
        {/* Statement / breakdown */}
        <Card
          padding="18px 0 6px"
          title={<span style={{ paddingLeft: 20 }}>{title}</span>}
          subtitle={<span style={{ paddingLeft: 20, display: 'inline-block' }}>{range.from} → {range.to}{compareTitle ? ` · compared with ${compareTitle}` : ''}</span>}
          action={
            <div className="fin-no-print" style={{ display: 'flex', gap: 6, paddingRight: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {data.series.length > 1 && (
                <Segmented size="sm" value={view} onChange={setView} options={[{ id: 'statement', label: 'Statement' }, { id: 'breakdown', label: 'By period' }]} />
              )}
              <button type="button" onClick={() => setHideEmpty(h => !h)} title={hideEmpty ? 'Show empty lines' : 'Hide empty lines'} style={{ ...btnSecondary, padding: '5px 8px' }}>
                {hideEmpty ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button type="button" onClick={downloadCSV} style={{ ...btnSecondary, padding: '5px 9px', fontSize: '0.76rem' }}><Download size={13} /> CSV</button>
              <button type="button" onClick={() => window.print()} style={{ ...btnSecondary, padding: '5px 9px', fontSize: '0.76rem' }}><Printer size={13} /> Print</button>
            </div>
          }
        >
          {view === 'statement' || data.series.length <= 1 ? (
            <StatementTable lines={visibleLines} pl={pl} prev={p} />
          ) : (
            <BreakdownTable lines={visibleLines} buckets={data.series} bucketPLs={bucketPLs} total={pl} />
          )}
        </Card>

        {/* Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="From revenue to profit" subtitle="Each bar starts where the previous one ended">
            {pl.revenue.total === 0 && pl.expenses === 0 ? (
              <div style={{ height: 230, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={waterfall} barCategoryGap="22%" margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={56} tickFormatter={fmtCompact} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={({ active, payload }: any) => active && payload?.length ? (
                    <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '7px 11px', fontSize: '0.78rem', boxShadow: '0 6px 18px rgba(15,23,42,0.1)' }}>
                      <b>{payload[0].payload.name}</b>: {fmt(payload[0].payload.shown)}
                    </div>
                  ) : null} />
                  <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    {waterfall.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    <LabelList dataKey="shown" position="top" formatter={(v: any) => fmtCompact(Number(v))} style={{ fontSize: 10, fill: '#334155', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {data.series.length > 1 && (
            <Card title="Margin trend" subtitle="Share of revenue kept, per period" action={<GranularityToggle />}>
              {marginSeries.every(m => m.gross == null) ? (
                <div style={{ height: 200, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>No revenue yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={marginSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} minTickGap={12} />
                    {/* Capped at ±100%: one tiny-revenue bucket would otherwise flatten every other point */}
                    <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={44} tickFormatter={v => `${v}%`}
                      domain={[(min: number) => Math.max(-100, Math.floor(min / 10) * 10), 100]} allowDataOverflow />
                    <ReferenceLine y={0} stroke="#cbd5e1" />
                    <Tooltip formatter={(v: any, n: any) => [`${v}%`, n]} contentStyle={{ fontSize: '0.78rem', borderRadius: 8, border: '1px solid #e2e7ee' }} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: '0.74rem' }} />
                    <Line dataKey="gross" name="Gross margin" stroke={CHART.revenue} strokeWidth={2} dot={marginSeries.length <= 31 ? { r: 3 } : false} connectNulls type="monotone" />
                    <Line dataKey="net" name="Net margin" stroke={CHART.expenses} strokeWidth={2} dot={marginSeries.length <= 31 ? { r: 3 } : false} connectNulls type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          )}

          <UnitEconomics data={data} />
        </div>
      </div>
    </div>
  );
};

// ─── tables ───────────────────────────────────────────────────────────────────

const cellPad = '7px 10px';

const StatementTable = ({ lines, pl, prev }: { lines: Line[]; pl: PLBreakdown; prev: FinanceSummary | null }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: prev ? 500 : 340 }}>
      <thead>
        <tr style={{ color: '#64748b', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <th style={{ textAlign: 'left', padding: cellPad, paddingLeft: 20, fontWeight: 800 }}>Line</th>
          <th style={{ textAlign: 'right', padding: cellPad, fontWeight: 800 }}>This period</th>
          {prev && <th style={{ textAlign: 'right', padding: cellPad, fontWeight: 800 }}>Comparison</th>}
          {prev && <th style={{ textAlign: 'right', padding: cellPad, fontWeight: 800 }}>Change</th>}
          <th style={{ textAlign: 'right', padding: cellPad, paddingRight: 20, fontWeight: 800 }}>% rev</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => {
          if (isSection(l)) {
            return (
              <tr key={`s${i}`}>
                <td colSpan={prev ? 5 : 3} style={{ padding: '14px 20px 4px', fontSize: '0.64rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{l.section}</td>
              </tr>
            );
          }
          const v = l.get(pl);
          const pv = prev ? l.get(prev.pl) : null;
          const strong = l.total || l.highlight;
          const bg = l.highlight ? (v >= 0 ? '#f0fdf4' : '#fef2f2') : undefined;
          const color = l.highlight ? (v >= 0 ? '#15803d' : '#b91c1c') : strong ? '#0f172a' : '#334155';
          return (
            <tr key={l.label} style={{ background: bg, borderTop: l.total ? '1px solid #e2e7ee' : undefined }}>
              <td style={{ padding: cellPad, paddingLeft: l.indent ? 34 : 20, fontWeight: strong ? 800 : l.kind === 'pct' ? 500 : 500, color: l.kind === 'pct' ? '#64748b' : color, fontStyle: l.kind === 'pct' ? 'italic' : undefined }}>{l.label}</td>
              <td style={{ padding: cellPad, textAlign: 'right', fontWeight: strong ? 800 : 500, color: l.kind === 'pct' ? '#64748b' : color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtVal(v, l.kind)}</td>
              {prev && <td style={{ padding: cellPad, textAlign: 'right', color: '#94a3b8', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtVal(pv!, l.kind)}</td>}
              {prev && (
                <td style={{ padding: cellPad, textAlign: 'right' }}>
                  {l.kind === 'pct'
                    ? <Delta value={v - pv!} points goodWhen="up" />
                    : (v !== 0 || pv !== 0) && <Delta value={pctChange(v, pv)} goodWhen={l.kind === 'cost' ? 'down' : 'up'} />}
                </td>
              )}
              <td style={{ padding: cellPad, paddingRight: 20, textAlign: 'right', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                {l.kind !== 'pct' && pl.revenue.total ? `${((v / pl.revenue.total) * 100).toFixed(1)}%` : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const BreakdownTable = ({ lines, buckets, bucketPLs, total }: {
  lines: Line[]; buckets: FinanceSummary['series']; bucketPLs: PLBreakdown[]; total: PLBreakdown;
}) => (
  <div style={{ overflowX: 'auto', maxHeight: 640 }}>
    <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.76rem', minWidth: '100%' }}>
      <thead>
        <tr>
          <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 2, background: '#fff', textAlign: 'left', padding: '7px 12px 7px 20px', fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e7ee', minWidth: 190 }}>Line</th>
          {buckets.map(b => (
            <th key={b.key} title={`${b.from} → ${b.to}`} style={{ position: 'sticky', top: 0, background: '#fff', textAlign: 'right', padding: '7px 10px', fontSize: '0.68rem', color: '#64748b', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap' }}>{b.label}</th>
          ))}
          <th style={{ position: 'sticky', top: 0, background: '#f8fafc', textAlign: 'right', padding: '7px 16px 7px 10px', fontSize: '0.68rem', color: '#0f172a', borderBottom: '1px solid #e2e7ee' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => {
          if (isSection(l)) {
            return (
              <tr key={`s${i}`}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '12px 12px 3px 20px', fontSize: '0.62rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{l.section}</td>
                <td colSpan={buckets.length + 1} />
              </tr>
            );
          }
          const strong = l.total || l.highlight;
          const rowBg = l.highlight ? '#f8fafc' : '#fff';
          return (
            <tr key={l.label}>
              <td style={{ position: 'sticky', left: 0, background: rowBg, padding: '6px 12px', paddingLeft: l.indent ? 32 : 20, fontWeight: strong ? 800 : 500, color: l.kind === 'pct' ? '#64748b' : '#0f172a', whiteSpace: 'nowrap', borderTop: l.total ? '1px solid #e2e7ee' : undefined }}>{l.label}</td>
              {bucketPLs.map((b, j) => {
                const v = l.get(b);
                const neg = l.kind !== 'cost' && v < 0;
                return (
                  <td key={j} style={{ background: rowBg, padding: '6px 10px', textAlign: 'right', fontWeight: strong ? 700 : 400, color: v === 0 ? '#cbd5e1' : neg ? '#b91c1c' : '#334155', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderTop: l.total ? '1px solid #e2e7ee' : undefined }}>
                    {l.kind === 'pct' ? (b.revenue.total ? fmtPct(v) : '—') : v === 0 ? '–' : fmtCompact(v)}
                  </td>
                );
              })}
              <td style={{ background: '#f8fafc', padding: '6px 16px 6px 10px', textAlign: 'right', fontWeight: 800, color: l.kind !== 'cost' && l.get(total) < 0 ? '#b91c1c' : '#0f172a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderTop: l.total ? '1px solid #e2e7ee' : undefined }}>
                {fmtVal(l.get(total), l.kind)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/** Per-order economics — what one delivered order actually earns. */
const UnitEconomics = ({ data }: { data: FinanceSummary }) => {
  const n = data.orders.delivered.count;
  if (!n) return null;
  const pl = data.pl;
  const per = (v: number) => v / n;
  const rows = [
    { label: 'Revenue per order', v: per(pl.revenue.total) },
    { label: 'Production cost', v: -per(pl.cogs.total) },
    { label: 'Ad cost (CAC)', v: -per(pl.opex.ads_meta + pl.opex.ads_google) },
    { label: 'Courier', v: -per(pl.opex.courier_fees) },
    { label: 'Overheads & other', v: -per(pl.opex.total - pl.opex.ads_meta - pl.opex.ads_google - pl.opex.courier_fees) },
  ];
  const profit = per(pl.net_profit);
  return (
    <Card title="Unit economics" subtitle={`Averaged over ${n} invoiced deliveries`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#334155' }}>{r.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: r.v < 0 ? '#64748b' : '#0f172a', fontWeight: 600 }}>{fmt(r.v)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e7ee', paddingTop: 7, marginTop: 2 }}>
          <b>Profit per order</b>
          <b style={{ color: profit >= 0 ? '#15803d' : '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>{fmt(profit)}</b>
        </div>
      </div>
    </Card>
  );
};
