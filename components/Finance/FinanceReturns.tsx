'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, Truck, Wallet, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fmt, fmtPct, CHART, MONTHS_SHORT } from './shared';
import { Card, KpiCard, LoadingState, ErrorState } from './ui';
import { usePeriod } from './period';

type Agg = { key: string; orders: number; delivered: number; returned: number; rate: number; returnFees: number; lostValue: number };
type Report = {
  totals: { orders: number; returned: number; delivered: number; rate: number; returnFees: number; lostValue: number };
  byMonth: Agg[]; byZone: Agg[]; byArea: Agg[]; byProduct: Agg[]; byValue: Agg[];
  repeatReturners: { phone: string; name: string; delivered: number; returned: number; returnFees: number; lastReturn: string; rate: number }[];
};

const rateColor = (r: number, avg: number) => (r >= avg * 1.25 ? '#b91c1c' : r <= avg * 0.75 ? '#15803d' : '#334155');

/** Ranked list with a rate bar — the overall rate is marked so outliers stand out. */
const Breakdown = ({ title, subtitle, rows, avg }: { title: string; subtitle?: string; rows: Agg[]; avg: number }) => (
  <Card title={title} subtitle={subtitle}>
    {rows.length === 0 ? <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Not enough orders.</p> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map(r => (
          <div key={r.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.79rem', marginBottom: 4 }}>
              <span style={{ color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.key}>{r.key}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <b style={{ color: rateColor(r.rate, avg), fontVariantNumeric: 'tabular-nums' }}>{fmtPct(r.rate, 0)}</b>
                <span style={{ color: '#94a3b8' }}> · {r.returned}/{r.orders}</span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 6, background: '#f1f5f9', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${Math.min(100, r.rate)}%`, background: CHART.expenses, borderRadius: 99, opacity: 0.8 }} />
              <div title={`Overall ${fmtPct(avg, 0)}`} style={{ position: 'absolute', top: -2, bottom: -2, left: `${Math.min(100, avg)}%`, width: 2, background: '#0f172a', borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);

export const FinanceReturns: React.FC = () => {
  const { range, label } = usePeriod();
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/finance/returns?from=${range.from}&to=${range.to}`, { signal: ctrl.signal })
      .then(async r => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || 'Failed'); return j; })
      .then(j => { setData(j); setError(null); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [range.from, range.to, nonce]);

  if (!data && loading) return <LoadingState label="Analysing returns…" />;
  if (!data && error) return <ErrorState message="Could not analyse returns" hint={error} onRetry={() => setNonce(n => n + 1)} />;
  if (!data) return null;

  const t = data.totals;
  const avg = t.rate;
  const monthData = data.byMonth.map(m => ({ ...m, label: `${MONTHS_SHORT[Number(m.key.slice(5)) - 1]} ’${m.key.slice(2, 4)}` }));
  const worstZone = data.byZone.filter(z => z.key !== 'Unknown').sort((a, b) => b.rate - a.rate)[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: loading ? 0.65 : 1 }}>
      {loading && <div className="fin-loading-bar" style={{ marginTop: -10 }} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <KpiCard label="Return rate" icon={RotateCcw} value={t.orders ? fmtPct(t.rate) : '—'}
          tone={!t.orders ? undefined : t.rate < 15 ? 'good' : t.rate < 25 ? 'warn' : 'bad'} sub={`${t.returned} of ${t.orders} orders · ${label}`} />
        <KpiCard label="Return fees paid" icon={Truck} value={fmt(t.returnFees)} sub={t.returned ? `${fmt(t.returnFees / t.returned)} per return` : undefined} />
        <KpiCard label="Sales lost to returns" icon={Wallet} value={fmt(t.lostValue)} sub="Order value that came back" />
        <KpiCard label="Highest-return zone" icon={Users} value={worstZone ? worstZone.key : '—'} sub={worstZone ? `${fmtPct(worstZone.rate, 0)} returned (${worstZone.orders} orders)` : undefined} />
      </div>

      {monthData.length > 1 && (
        <Card title="Return rate by month" subtitle="Customer returns ÷ (delivered + returned), by order date. The line marks this period's overall rate.">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${v}%`} />
              <ReferenceLine y={avg} stroke="#0f172a" strokeWidth={1.5} />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={({ active, payload }: any) => active && payload?.length ? (
                <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 8, padding: '8px 11px', fontSize: '0.78rem', boxShadow: '0 6px 18px rgba(15,23,42,0.1)' }}>
                  <b>{payload[0].payload.label}</b>: {fmtPct(payload[0].payload.rate)}<br />
                  <span style={{ color: '#64748b' }}>{payload[0].payload.returned} returned of {payload[0].payload.orders} · {fmt(payload[0].payload.returnFees)} fees</span>
                </div>
              ) : null} />
              <Bar dataKey="rate" name="Return rate" fill={CHART.expenses} radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Breakdown title="By delivery zone" subtitle="Zone from Pathao's delivery fee tier" rows={data.byZone} avg={avg} />
        <Breakdown title="By order value" subtitle="Do cheaper or pricier orders come back more?" rows={data.byValue} avg={avg} />
        <Breakdown title="By area" subtitle="Matched from the address · 5+ orders" rows={data.byArea} avg={avg} />
        <Breakdown title="By product" subtitle="Most returns first · 5+ orders" rows={data.byProduct} avg={avg} />
      </div>

      <Card title="Repeat returners" subtitle="Customers (by phone) who returned 2+ orders in this period — consider asking for an advance on their next order">
        {data.repeatReturners.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No customer returned more than once in this period.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 520 }}>
              <thead>
                <tr>{['Customer', 'Phone', 'Returned', 'Delivered', 'Return fees', 'Last return'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Customer' || h === 'Phone' ? 'left' : 'right', padding: '7px 10px', fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e7ee' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {data.repeatReturners.map(c => (
                  <tr key={c.phone}>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600 }}>{c.name || '—'}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{c.phone}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#b91c1c', fontWeight: 700 }}>{c.returned}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{c.delivered}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.returnFees)}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#64748b' }}>{c.lastReturn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
        Counts customer orders only: Pathao’s reverse consignments (the parcel coming back to you) are excluded so each return is counted once.
      </p>
    </div>
  );
};
