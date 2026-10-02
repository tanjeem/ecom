'use client';

// Printable monthly finance pack: open it, check it, press "Save as PDF".
// Everything comes from the same APIs as the Finance tab, so numbers match.

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FinanceSummary, PLBreakdown } from '@/lib/finance/types';
import { addMonths, endOf } from '@/lib/finance/periods';

type Products = { products: { product_id: number; name: string; units: number; revenue: number; profit: number; margin: number; returnRate: number }[] };
type Customers = { period: { active: number; newCustomers: number; returning: number; cac: number | null; revenuePerCustomer: number }; lifetime: { repeatRate: number; avgLtv: number } };
type Stock = { totals: { units: number; costValue: number; retailValue: number; coverDays: number | null; deadUnits: number; deadValue: number } };

const fmt = (n: number) => `${n < 0 ? '−' : ''}৳${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
const pct = (n: number) => `${Number.isFinite(n) ? n.toFixed(1) : '0'}%`;
const monthName = (m: string) => new Date(`${m}-15T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const change = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

const get = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Failed: ${url}`);
  return j;
};

const LINES: { label: string; get: (p: PLBreakdown) => number; bold?: boolean; cost?: boolean; pct?: boolean }[] = [
  { label: 'Revenue (Pathao collected)', get: p => p.revenue.total, bold: true },
  { label: 'Product cost', get: p => p.cogs.total, cost: true },
  { label: 'Gross profit', get: p => p.gross_profit, bold: true },
  { label: 'Gross margin', get: p => p.gross_margin, pct: true },
  { label: 'Meta & Google ads', get: p => p.opex.ads_meta + p.opex.ads_google, cost: true },
  { label: 'Photoshoot', get: p => p.opex.photoshoot, cost: true },
  { label: 'Pathao fees', get: p => p.opex.courier_fees, cost: true },
  { label: 'Rent & salaries', get: p => p.opex.rent + p.opex.salary, cost: true },
  { label: 'Transport & other', get: p => p.opex.transport + p.opex.miscellaneous, cost: true },
  { label: 'Operating profit', get: p => p.operating_profit, bold: true },
  { label: 'Other income', get: p => p.other_income },
  { label: 'Net profit', get: p => p.net_profit, bold: true },
  { label: 'Net margin', get: p => p.net_margin, pct: true },
];

function Report() {
  const params = useSearchParams();
  const router = useRouter();
  const month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month')! : new Date().toISOString().slice(0, 7);
  const from = `${month}-01`;
  const to = endOf(from, 'month');
  const prevFrom = addMonths(from, -1);
  const prevTo = endOf(prevFrom, 'month');

  const [data, setData] = useState<{ cur: FinanceSummary; prev: FinanceSummary; products: Products | null; customers: Customers | null; stock: Stock | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    Promise.all([
      get<FinanceSummary>(`/api/finance/summary?from=${from}&to=${to}&granularity=week`),
      get<FinanceSummary>(`/api/finance/summary?from=${prevFrom}&to=${prevTo}&granularity=week`),
      get<Products>(`/api/finance/products?from=${from}&to=${to}`).catch(() => null),
      get<Customers>(`/api/finance/customers?from=${from}&to=${to}`).catch(() => null),
      get<Stock>('/api/finance/stock').catch(() => null),
    ]).then(([cur, prev, products, customers, stock]) => setData({ cur, prev, products, customers, stock }))
      .catch(e => setError(e.message));
  }, [from, to, prevFrom, prevTo]);

  const go = (n: number) => router.replace(`/finance/report?month=${addMonths(from, n).slice(0, 7)}`);

  if (error) return <p style={{ padding: 40, color: '#b91c1c' }}>{error}</p>;

  const toolbar = (
    <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 2, background: '#0f172a', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => go(-1)} style={tbtn} aria-label="Previous month"><ChevronLeft size={16} /></button>
      <b style={{ minWidth: 130, textAlign: 'center' }}>{monthName(month)}</b>
      <button type="button" onClick={() => go(1)} style={tbtn} aria-label="Next month"><ChevronRight size={16} /></button>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Print → “Save as PDF” to share</span>
      <button type="button" onClick={() => window.print()} disabled={!data} style={{ ...tbtn, background: '#2a78d6', padding: '7px 14px', fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <Printer size={15} /> Print / PDF
      </button>
    </div>
  );

  if (!data) return <>{toolbar}<p style={{ padding: 40, color: '#64748b', textAlign: 'center' }}>Preparing the {monthName(month)} report…</p></>;

  const { cur, prev, products, customers, stock } = data;
  const p = cur.pl;
  const q = prev.pl;
  const ads = p.opex.ads_meta + p.opex.ads_google;
  const prevAds = q.opex.ads_meta + q.opex.ads_google;

  const kpis = [
    { label: 'Revenue', value: fmt(p.revenue.total), d: change(p.revenue.total, q.revenue.total), good: 'up' },
    { label: 'Gross profit', value: fmt(p.gross_profit), sub: `${pct(p.gross_margin)} margin`, d: change(p.gross_profit, q.gross_profit), good: 'up' },
    { label: 'Net profit', value: fmt(p.net_profit), sub: `${pct(p.net_margin)} margin`, d: change(p.net_profit, q.net_profit), good: 'up' },
    { label: 'Delivered orders', value: cur.orders.delivered.count.toLocaleString(), sub: `AOV ${fmt(cur.orders.aov)}`, d: change(cur.orders.delivered.count, prev.orders.delivered.count), good: 'up' },
    { label: 'Return rate', value: pct(cur.orders.returnRate), sub: `${cur.orders.returned.count} returns`, d: cur.orders.returnRate - prev.orders.returnRate, pts: true, good: 'down' },
    { label: 'Ad spend', value: fmt(ads), sub: ads ? `${(p.revenue.total / ads).toFixed(2)}× return (MER)` : undefined, d: change(ads, prevAds), good: 'neutral' },
  ];

  // Plain-language highlights from the biggest moves
  const highlights: string[] = [];
  const rd = change(p.revenue.total, q.revenue.total);
  if (rd != null) highlights.push(`Revenue ${rd >= 0 ? 'grew' : 'fell'} ${Math.abs(rd).toFixed(0)}% to ${fmt(p.revenue.total)} (${monthName(prevFrom.slice(0, 7))}: ${fmt(q.revenue.total)}).`);
  highlights.push(p.net_profit >= 0 ? `Kept ${pct(p.net_margin)} of revenue as net profit (${fmt(p.net_profit)}).` : `Made a net loss of ${fmt(-p.net_profit)}.`);
  if (ads) highlights.push(`Every ৳1 of ads returned ৳${(p.revenue.total / ads).toFixed(2)} in revenue${prevAds ? ` (vs ৳${(q.revenue.total / prevAds).toFixed(2)} the month before)` : ''}.`);
  const costMoves = (Object.keys(p.groups) as (keyof typeof p.groups)[]).map(k => ({ k, d: p.groups[k] - q.groups[k] })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  if (costMoves[0] && Math.abs(costMoves[0].d) > 2000) highlights.push(`Biggest cost change: ${costMoves[0].k} ${costMoves[0].d > 0 ? 'up' : 'down'} ${fmt(Math.abs(costMoves[0].d))}.`);
  if (customers) highlights.push(`${customers.period.newCustomers} new customers${customers.period.cac ? ` at ${fmt(customers.period.cac)} each in ads` : ''}; ${customers.period.returning} came back.`);
  const top = (products?.products || []).filter(x => x.units > 0).sort((a, b) => b.profit - a.profit).slice(0, 5);
  if (top[0]) highlights.push(`Best product: ${top[0].name} — ${fmt(top[0].profit)} profit on ${Math.round(top[0].units)} units.`);

  const weeks = cur.series;
  const maxW = Math.max(1, ...weeks.map(w => Math.max(w.revenue, w.expenses)));

  return (
    <>
      {toolbar}
      <main className="sheet">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: 10, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>Monthly finance report</div>
            <h1 style={{ margin: '4px 0 0', fontSize: '1.7rem' }}>{monthName(month)}</h1>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'right' }}>Compared with {monthName(prevFrom.slice(0, 7))}<br />Prepared {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </header>

        <section className="kpis">
          {kpis.map(k => {
            const good = k.d == null || k.good === 'neutral' ? null : (k.good === 'up' ? k.d >= 0 : k.d <= 0);
            return (
              <div key={k.label} className="kpi">
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value">{k.value}</div>
                <div className="kpi-sub">
                  {k.d != null && <span style={{ color: good == null ? '#475569' : good ? '#15803d' : '#b91c1c', fontWeight: 700 }}>{k.d >= 0 ? '▲' : '▼'} {Math.abs(k.d).toFixed(k.pts ? 1 : 0)}{k.pts ? ' pts' : '%'}</span>}
                  {k.sub && <span> · {k.sub}</span>}
                </div>
              </div>
            );
          })}
        </section>

        <h2>Highlights</h2>
        <ul style={{ margin: '0 0 6px', paddingLeft: 18, lineHeight: 1.65, fontSize: '0.86rem' }}>
          {highlights.map(h => <li key={h}>{h}</li>)}
        </ul>

        <section>
          <h2>Profit &amp; loss</h2>
          <table>
            <thead><tr><th /><th className="r">{monthName(month).split(' ')[0].slice(0, 3)}</th><th className="r">{monthName(prevFrom.slice(0, 7)).split(' ')[0].slice(0, 3)}</th><th className="r">Change</th></tr></thead>
            <tbody>
              {LINES.filter(l => l.bold || l.pct || l.get(p) || l.get(q)).map(l => {
                const a = l.get(p);
                const b = l.get(q);
                const c = l.pct ? a - b : change(a, b);
                return (
                  <tr key={l.label} style={{ fontWeight: l.bold ? 800 : 400 }}>
                    <td style={{ paddingLeft: l.bold || l.pct ? 0 : 10, color: l.pct ? '#64748b' : undefined }}>{l.label}</td>
                    <td className="r">{l.pct ? pct(a) : l.cost ? `−${fmt(a)}` : fmt(a)}</td>
                    <td className="r" style={{ color: '#64748b' }}>{l.pct ? pct(b) : l.cost ? `−${fmt(b)}` : fmt(b)}</td>
                    <td className="r" style={{ color: '#64748b', fontSize: '0.74rem' }}>{c == null ? '—' : `${c >= 0 ? '+' : ''}${c.toFixed(l.pct ? 1 : 0)}${l.pct ? ' pts' : '%'}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <div className="two">
          <section>
            <h2>Week by week</h2>
            <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: '#475569', marginBottom: 6 }}>
              <span><i className="sw" style={{ background: '#2a78d6' }} /> Revenue</span><span><i className="sw" style={{ background: '#eb6834' }} /> Costs</span>
            </div>
            {weeks.map(w => (
              <div key={w.key} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 74px', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '0.74rem' }}>
                <span style={{ color: '#64748b' }}>{w.label}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ height: 7, width: `${(w.revenue / maxW) * 100}%`, background: '#2a78d6', borderRadius: 3 }} />
                  <div style={{ height: 7, width: `${(w.expenses / maxW) * 100}%`, background: '#eb6834', borderRadius: 3 }} />
                </div>
                <span className="r" style={{ fontWeight: 700, color: w.net >= 0 ? '#15803d' : '#b91c1c' }}>{fmt(w.net)}</span>
              </div>
            ))}
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Right column: net profit for the week</div>
          </section>
          <section>
            {customers && (
              <>
                <h2>Customers</h2>
                <div className="facts">
                  <span>New customers</span><b>{customers.period.newCustomers}</b>
                  <span>Returning customers</span><b>{customers.period.returning}</b>
                  <span>Ad cost per new customer</span><b>{customers.period.cac ? fmt(customers.period.cac) : '—'}</b>
                  <span>Lifetime value per customer</span><b>{fmt(customers.lifetime.avgLtv)}</b>
                  <span>Repeat rate (all time)</span><b>{pct(customers.lifetime.repeatRate)}</b>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="two">
          {top.length > 0 && (
            <section>
              <h2>Top products by profit</h2>
              <table>
                <thead><tr><th>Product</th><th className="r">Units</th><th className="r">Revenue</th><th className="r">Profit</th></tr></thead>
                <tbody>
                  {top.map(x => (
                    <tr key={x.product_id}><td>{x.name}</td><td className="r">{Math.round(x.units)}</td><td className="r">{fmt(x.revenue)}</td><td className="r" style={{ fontWeight: 700 }}>{fmt(x.profit)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {stock && (
            <section>
              <h2>Stock (as of today)</h2>
              <div className="facts">
                <span>Units on hand</span><b>{stock.totals.units.toLocaleString()}</b>
                <span>Value at cost</span><b>{fmt(stock.totals.costValue)}</b>
                <span>Value at selling price</span><b>{fmt(stock.totals.retailValue)}</b>
                <span>Lasts at current pace</span><b>{stock.totals.coverDays ? `${Math.round(stock.totals.coverDays)} days` : '—'}</b>
                <span>Unsold for 90+ days</span><b>{fmt(stock.totals.deadValue)} ({stock.totals.deadUnits} units)</b>
              </div>
            </section>
          )}
        </div>

        <footer style={{ marginTop: 22, paddingTop: 10, borderTop: '1px solid #e2e7ee', fontSize: '0.66rem', color: '#94a3b8', lineHeight: 1.55 }}>
          Revenue is cash Pathao collected on paid invoices, dated by invoice. Product cost is units sold × unit cost. Meta ad spend is from the Meta API (USD × 130 + 15% VAT).
          Fixed costs are spread evenly across each month. {cur.cogs.pricedShare < 1 && `${Math.round((1 - cur.cogs.pricedShare) * 100)}% of units are costed at the default ${fmt(cur.cogs.fallbackUnitCost)}/unit.`}
        </footer>
      </main>
      <style>{CSS}</style>
    </>
  );
}

const tbtn: React.CSSProperties = { background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 7, padding: 6, cursor: 'pointer', display: 'inline-flex' };

const CSS = `
  body { background: #e5e7eb; }
  .sheet { background: #fff; color: #0f172a; max-width: 820px; margin: 20px auto; padding: 36px 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); font-size: 14px; }
  .sheet h2 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin: 20px 0 8px; }
  .sheet table { width: 100%; min-width: 0; border-collapse: collapse; font-size: 0.8rem; }
  .sheet td span { color: inherit; font-size: inherit; }
  .sheet th, .sheet td { white-space: normal; }
  .sheet th { text-align: left; font-size: 0.66rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #cbd5e1; padding: 5px 4px; }
  .sheet td { padding: 5px 4px; border-bottom: 1px solid #f1f5f9; }
  .sheet .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .kpi { border: 1px solid #e2e7ee; border-radius: 9px; padding: 10px 12px; }
  .kpi-label { font-size: 0.64rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
  .kpi-value { font-size: 1.3rem; font-weight: 900; margin: 3px 0 2px; font-variant-numeric: tabular-nums; }
  .kpi-sub { font-size: 0.7rem; color: #64748b; }
  .two { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 26px; }
  .facts { display: grid; grid-template-columns: 1fr auto; gap: 5px 12px; font-size: 0.8rem; }
  .facts span { color: #475569; } .facts b { text-align: right; font-variant-numeric: tabular-nums; }
  .sw { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  @media (max-width: 700px) { .sheet { padding: 20px 16px; margin: 0; } .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .two { grid-template-columns: minmax(0, 1fr); gap: 0; } }
  @media print {
    @page { size: A4; margin: 12mm; }
    body { background: #fff; }
    .no-print { display: none !important; }
    .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    .kpi, section { break-inside: avoid; }
  }
`;

export default function ReportPage() {
  return <Suspense fallback={null}><Report /></Suspense>;
}
