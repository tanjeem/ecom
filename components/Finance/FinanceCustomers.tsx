'use client';

import React from 'react';
import { Users, Repeat, Target, Gem, Info, AlertTriangle } from 'lucide-react';
import { fmt, fmtPct } from './shared';
import { Card, KpiCard, LoadingState, ErrorState } from './ui';
import { usePeriod } from './period';
import { useApi, th, td, num } from './useApi';

type Data = {
  coverage: { parcels: number; withPhone: number; share: number };
  period: { active: number; newCustomers: number; returning: number; revenue: number; orders: number; revenuePerCustomer: number; newRevenue: number; adSpend: number; cac: number | null; grossMargin: number };
  lifetime: { customers: number; repeatRate: number; ordersPerCustomer: number; avgLtv: number; avgLtvProfit: number | null; medianDaysBetween: number | null };
  segments: { oneTime: number; repeat: number; loyal: number; atRisk: number };
  cohorts: { month: string; size: number; again30: number; again90: number; repeat: number; revenuePerCustomer: number; mature30: boolean; mature90: boolean }[];
  top: { name: string; phone: string; orders: number; revenue: number; returns: number; first: string; last: string }[];
};

const monthLabel = (m: string) => new Date(`${m}-15T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
const dateLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
// Sequential single-hue ramp for retention cells (light → dark blue)
const heat = (pct: number) => `rgba(42, 120, 214, ${Math.min(0.85, 0.06 + pct / 40)})`;

export const FinanceCustomers: React.FC = () => {
  const { range, label } = usePeriod();
  const { data, error, loading, reload } = useApi<Data>(`/api/finance/customers?from=${range.from}&to=${range.to}`);

  if (loading && !data) return <LoadingState label="Matching customers by phone…" />;
  if (error && !data) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data) return null;

  const { period: p, lifetime: l, segments: s } = data;
  // Average new customers per month over the last 6 cohorts — used when the period has no sales yet
  const recentCohorts = data.cohorts.slice(-6);
  const typicalMonth = recentCohorts.length ? recentCohorts.reduce((t, c) => t + c.size, 0) / recentCohorts.length : 0;
  const ltvCac = p.cac && l.avgLtvProfit ? l.avgLtvProfit / p.cac : null;
  const segTotal = s.oneTime + s.repeat + s.loyal || 1;
  const segs = [
    { label: 'One order', value: s.oneTime, color: '#cbd5e1' },
    { label: '2–3 orders', value: s.repeat, color: '#2a78d6' },
    { label: '4+ orders (loyal)', value: s.loyal, color: '#0f3d7a' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="fin-kpi-grid">
        <KpiCard label="Customers" icon={Users} value={p.active.toLocaleString()} sub={`${p.newCustomers} new · ${p.returning} returning · ${label}`} />
        <KpiCard label="Cost to win a customer" icon={Target} value={p.cac ? fmt(p.cac) : '—'}
          sub={p.cac ? `${fmt(p.adSpend)} ads ÷ ${p.newCustomers} new customers` : 'Needs ad spend and new customers in the period'} />
        <KpiCard label="Customer lifetime value" icon={Gem} value={fmt(l.avgLtv)}
          sub={l.avgLtvProfit ? `≈ ${fmt(l.avgLtvProfit)} gross profit per customer` : 'Average revenue per customer, all time'} />
        <KpiCard label="Repeat rate" icon={Repeat} value={fmtPct(l.repeatRate)} tone={l.repeatRate >= 20 ? 'good' : l.repeatRate >= 10 ? 'warn' : 'bad'}
          sub={`${l.customers.toLocaleString()} customers ever · ${l.ordersPerCustomer.toFixed(2)} orders each`} />
      </div>

      <div className="fin-grid-2">
        <Card title="What a customer is worth vs what they cost" subtitle={`Ad cost per new customer in ${label}, against lifetime gross profit`}>
          {ltvCac != null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: ltvCac >= 3 ? '#15803d' : ltvCac >= 1.5 ? '#b45309' : '#b91c1c' }}>{ltvCac.toFixed(1)}×</span>
                <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                  {ltvCac >= 3 ? 'Healthy: each customer returns 3× what it cost to win them. Room to spend more on ads.'
                    : ltvCac >= 1.5 ? 'Profitable, but thin. Lift repeat purchases or lower cost per customer.'
                    : 'You barely earn back what you pay to win a customer.'}
                </span>
              </div>
              <Bar label="Lifetime gross profit" value={l.avgLtvProfit!} max={Math.max(l.avgLtvProfit!, p.cac!)} color="#1baf7a" />
              <Bar label="Ad cost to win them" value={p.cac!} max={Math.max(l.avgLtvProfit!, p.cac!)} color="#eb6834" />
            </>
          ) : <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Needs ad spend and new customers in this period.</p>}
          <div style={{ marginTop: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 9, fontSize: '0.76rem', color: '#475569', lineHeight: 1.55 }}>
            <b>Why it matters:</b> at a {fmtPct(l.repeatRate, 0)} repeat rate almost every sale needs new ad spend.
            Getting 1 in 5 customers to buy again would add about <b>{fmt(Math.max(0, 0.2 - l.repeatRate / 100) * (p.active || typicalMonth) * (p.revenuePerCustomer || l.avgLtv))}</b> in revenue {p.active ? 'per period like this one' : 'in a typical month'}, with no ad cost.
          </div>
        </Card>

        <Card title="Customer base" subtitle="All customers by number of delivered orders">
          <div style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', gap: 2, marginBottom: 12 }}>
            {segs.map(x => <div key={x.label} title={`${x.label}: ${x.value}`} style={{ width: `${(x.value / segTotal) * 100}%`, background: x.color, minWidth: x.value ? 3 : 0 }} />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {segs.map(x => (
              <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#334155' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: x.color }} />{x.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}><b>{x.value.toLocaleString()}</b> <span style={{ color: '#94a3b8' }}>({fmtPct((x.value / segTotal) * 100, 0)})</span></span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 12, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', color: '#64748b' }}>
            {s.atRisk > 0 && (
              <div style={{ display: 'flex', gap: 6, color: '#b45309' }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                <span><b>{s.atRisk}</b> repeat customers haven’t ordered in 90+ days. A WhatsApp or SMS offer to them is the cheapest sale you can make.</span>
              </div>
            )}
            {l.medianDaysBetween != null && <div>Repeat buyers come back after <b style={{ color: '#0f172a' }}>{l.medianDaysBetween} days</b> (median) — the best moment for a follow-up message.</div>}
          </div>
        </Card>
      </div>

      <Card title="Do new customers come back?" subtitle="Each row is the customers whose first order fell in that month. Faded cells are too recent to judge.">
        <div className="fin-table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th}>First order</th><th style={{ ...th, ...num }}>New customers</th>
                <th style={{ ...th, ...num }}>Back within 30 days</th><th style={{ ...th, ...num }}>Within 90 days</th>
                <th style={{ ...th, ...num }}>Ever came back</th><th style={{ ...th, ...num }}>Revenue / customer</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.slice().reverse().map(c => {
                const cell = (n: number, mature: boolean) => {
                  const pct = c.size ? (n / c.size) * 100 : 0;
                  return (
                    <td style={{ ...td, ...num, background: mature ? heat(pct) : '#fafafa', color: mature ? (pct > 15 ? '#fff' : '#0f172a') : '#cbd5e1', fontWeight: 700 }}>
                      {fmtPct(pct, 0)}
                    </td>
                  );
                };
                return (
                  <tr key={c.month}>
                    <td style={{ ...td, fontWeight: 700, color: '#0f172a' }}>{monthLabel(c.month)}</td>
                    <td style={{ ...td, ...num }}>{c.size}</td>
                    {cell(c.again30, c.mature30)}
                    {cell(c.again90, c.mature90)}
                    {cell(c.repeat, true)}
                    <td style={{ ...td, ...num }}>{fmt(c.revenuePerCustomer)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Top customers" subtitle="By lifetime delivered value — worth a thank-you note or early access to drops">
        <div className="fin-table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr><th style={th}>Customer</th><th style={th}>Phone</th><th style={{ ...th, ...num }}>Orders</th><th style={{ ...th, ...num }}>Lifetime value</th><th style={{ ...th, ...num }}>Returns</th><th style={th}>Last order</th></tr>
            </thead>
            <tbody>
              {data.top.map(c => (
                <tr key={c.phone} className="fin-row">
                  <td style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{c.name || '—'}</td>
                  <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>{c.phone}</td>
                  <td style={{ ...td, ...num }}>{c.orders}</td>
                  <td style={{ ...td, ...num, fontWeight: 700 }}>{fmt(c.revenue)}</td>
                  <td style={{ ...td, ...num, color: c.returns ? '#b91c1c' : '#94a3b8' }}>{c.returns}</td>
                  <td style={td}>{dateLabel(c.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', display: 'flex', gap: 6 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        Customers are matched by phone number across {data.coverage.parcels.toLocaleString()} delivered and returned Pathao parcels since Jan 2025. Cost per customer uses Meta + Google ad spend in the selected period.
      </p>
    </div>
  );
};

const Bar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#475569', marginBottom: 3 }}>
      <span>{label}</span><b style={{ color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</b>
    </div>
    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99 }}>
      <div style={{ width: `${(value / (max || 1)) * 100}%`, height: '100%', background: color, borderRadius: 99 }} />
    </div>
  </div>
);
