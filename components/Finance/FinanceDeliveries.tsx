'use client';

import React, { useMemo, useState } from 'react';
import { Truck, CheckCircle2, RotateCcw, Clock, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, KpiCard, LoadingState, ErrorState, EmptyState } from './ui';
import { fmt, CHART, inputStyle } from './shared';
import { useApi, th, td, num } from './useApi';
import { addDays, todayISO } from '@/lib/finance/periods';
import type { SentParcel, DeliveryOutcome } from '@/app/api/finance/pathao-orders/route';

type Data = { from: string; to: string; fetchedAt: string; parcels: SentParcel[] };

const RANGES: { id: string; label: string; days?: number }[] = [
  { id: '1', label: 'Today', days: 1 },
  { id: '2', label: '2 days', days: 2 },
  { id: '3', label: '3 days', days: 3 },
  { id: '4', label: '4 days', days: 4 },
  { id: '7', label: 'Week', days: 7 },
  { id: '30', label: 'Month', days: 30 },
  { id: '90', label: '3 months', days: 90 },
  { id: 'custom', label: 'Pick dates' },
];

type Group = 'day' | 'week' | 'month';

const OUTCOME: Record<DeliveryOutcome, { label: string; color: string; bg: string }> = {
  delivered: { label: 'Delivered', color: '#15803d', bg: '#f0fdf4' },
  returned: { label: 'Returned', color: '#b91c1c', bg: '#fef2f2' },
  on_way: { label: 'On the way', color: '#1d4ed8', bg: '#eff6ff' },
  waiting: { label: 'Waiting for pickup', color: '#b45309', bg: '#fffbeb' },
  cancelled: { label: 'Pickup cancelled', color: '#64748b', bg: '#f1f5f9' },
};

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const dayLabel = (iso: string) => DAY.format(new Date(`${iso}T00:00:00`));
const weekStart = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return addDays(iso, -((d.getDay() + 6) % 7)); // Monday
};
const bucketOf = (iso: string, g: Group) => (g === 'day' ? iso : g === 'week' ? weekStart(iso) : iso.slice(0, 7));
const bucketLabel = (key: string, g: Group) =>
  g === 'day' ? dayLabel(key) : g === 'week' ? `Week of ${dayLabel(key)}` : MONTH.format(new Date(`${key}-01T00:00:00`));

type Totals = Record<DeliveryOutcome, { n: number; value: number }> & { sent: { n: number; value: number }; fees: number };

function totalsOf(ps: SentParcel[]): Totals {
  const t = {
    delivered: { n: 0, value: 0 }, returned: { n: 0, value: 0 }, on_way: { n: 0, value: 0 }, waiting: { n: 0, value: 0 },
    cancelled: { n: 0, value: 0 }, sent: { n: 0, value: 0 }, fees: 0,
  } as Totals;
  for (const p of ps) {
    t[p.outcome].n++;
    t[p.outcome].value += p.amount;
    if (p.outcome === 'cancelled') continue;
    t.sent.n++;
    t.sent.value += p.amount;
    t.fees += p.fee;
  }
  return t;
}

/** Share of finished parcels (delivered or returned) that were delivered */
const successRate = (t: Totals) => {
  const done = t.delivered.n + t.returned.n;
  return done ? (t.delivered.n / done) * 100 : null;
};

export const FinanceDeliveries = () => {
  const today = todayISO();
  const [range, setRange] = useState('7');
  const [custom, setCustom] = useState({ from: addDays(today, -13), to: today });
  const [group, setGroup] = useState<Group | 'auto'>('auto');
  const [filter, setFilter] = useState<DeliveryOutcome | 'all'>('all');
  const [query, setQuery] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);

  const days = RANGES.find(r => r.id === range)?.days;
  const from = days ? addDays(today, -(days - 1)) : custom.from;
  const to = days ? today : custom.to;
  const { data, error, loading, reload } = useApi<Data>(`/api/finance/pathao-orders?from=${from}&to=${to}`);

  const spanDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const g: Group = group !== 'auto' ? group : spanDays > 92 ? 'month' : spanDays > 31 ? 'week' : 'day';

  const parcels = data?.parcels ?? [];
  const t = useMemo(() => totalsOf(parcels), [parcels]);
  const rate = successRate(t);

  const buckets = useMemo(() => {
    const m = new Map<string, SentParcel[]>();
    for (const p of parcels) {
      const k = bucketOf(p.date, g);
      m.set(k, [...(m.get(k) || []), p]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, ps]) => ({ key: k, t: totalsOf(ps) }));
  }, [parcels, g]);
  const maxSent = Math.max(1, ...buckets.map(b => b.t.sent.value));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parcels.filter(p => (filter === 'all' || p.outcome === filter) &&
      (!q || [p.consignmentId, p.orderNumber, p.customer, p.phone, p.address, p.items].some(s => s.toLowerCase().includes(q))));
  }, [parcels, filter, query]);

  const chip = (active: boolean) => ({
    border: '1px solid #e2e7ee', borderRadius: 99, padding: '6px 13px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    background: active ? '#0f172a' : '#fff', color: active ? '#fff' : '#334155',
  } as const);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* range picker */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {RANGES.map(r => <button key={r.id} type="button" onClick={() => setRange(r.id)} style={chip(range === r.id)}>{r.label}</button>)}
        {range === 'custom' && (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
            <input type="date" value={custom.from} max={custom.to} onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} style={{ ...inputStyle, width: 'auto', padding: '5px 8px' }} />
            to
            <input type="date" value={custom.to} min={custom.from} max={today} onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} style={{ ...inputStyle, width: 'auto', padding: '5px 8px' }} />
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => reload(true)} disabled={loading} title="Fetch the latest from Pathao"
          style={{ ...chip(false), display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> {loading ? 'Fetching…' : 'Fetch from Pathao'}
        </button>
      </div>

      {error && !data ? <ErrorState message="Could not load Pathao orders" hint={error} onRetry={() => reload(true)} />
        : !data ? <LoadingState label="Fetching orders from Pathao…" />
        : (
        <>
          {spanDays > 45 && parcels.length > 0 && parcels[parcels.length - 1].date > addDays(from, 14) && (
            <p style={{ margin: 0, padding: '9px 12px', background: '#fffbeb', borderRadius: 9, fontSize: '0.76rem', color: '#92400e' }}>
              Pathao only keeps about the last 7 weeks of parcels. The earliest one it returned is from {dayLabel(parcels[parcels.length - 1].date)}, so totals before that are missing.
            </p>
          )}
          <div className="fin-kpi-grid">
            <KpiCard label="Sent on Pathao" icon={Truck} value={fmt(t.sent.value)}
              sub={`${t.sent.n} parcels · ${from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`}`} />
            <KpiCard label="Delivered" icon={CheckCircle2} tone="good" value={fmt(t.delivered.value)}
              sub={`${t.delivered.n} parcels${t.sent.value ? ` · ${Math.round((t.delivered.value / t.sent.value) * 100)}% of value sent` : ''}`} />
            <KpiCard label="Returned" icon={RotateCcw} tone={t.returned.n ? 'bad' : undefined} value={fmt(t.returned.value)}
              sub={`${t.returned.n} parcels`} onClick={t.returned.n ? () => setFilter('returned') : undefined} />
            <KpiCard label="Still out" icon={Clock} value={fmt(t.on_way.value + t.waiting.value)}
              sub={`${t.on_way.n} on the way · ${t.waiting.n} waiting for pickup`} />
            <KpiCard label="Delivery success" value={rate == null ? '—' : `${rate.toFixed(0)}%`}
              tone={rate == null ? undefined : rate >= 85 ? 'good' : rate >= 70 ? 'warn' : 'bad'}
              sub="of parcels that finished (delivered vs returned)" />
            <KpiCard label="Pathao charges" value={fmt(t.fees)} sub={`you receive about ${fmt(t.delivered.value - t.fees)}`} />
          </div>

          <Card title={`Day by day`} subtitle="What you sent each period and what happened to it (by the date the parcel was booked)"
            action={
              <div style={{ display: 'flex', gap: 4 }}>
                {(['auto', 'day', 'week', 'month'] as const).map(x => (
                  <button key={x} type="button" onClick={() => setGroup(x)} style={{ ...chip(group === x), padding: '4px 10px', fontSize: '0.72rem' }}>
                    {x === 'auto' ? 'Auto' : x[0].toUpperCase() + x.slice(1)}
                  </button>
                ))}
              </div>
            }>
            {!buckets.length ? <EmptyState title="No parcels sent in this period" /> : (
              <div className="fin-table-scroll">
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>{g === 'day' ? 'Day' : g === 'week' ? 'Week' : 'Month'}</th>
                      <th style={{ ...th, ...num }}>Sent</th><th style={th} />
                      <th style={{ ...th, ...num }}>Delivered</th><th style={{ ...th, ...num }}>Returned</th>
                      <th style={{ ...th, ...num }}>Still out</th><th style={{ ...th, ...num }}>Success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map(({ key, t: b }) => {
                      const r = successRate(b);
                      const seg = (v: number, c: string) => <span style={{ width: `${(v / maxSent) * 100}%`, background: c, height: '100%' }} />;
                      return (
                        <tr key={key}>
                          <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{bucketLabel(key, g)}</td>
                          <td style={{ ...td, ...num, fontWeight: 800 }}>{fmt(b.sent.value)}<div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500 }}>{b.sent.n} parcels</div></td>
                          <td style={{ ...td, width: '26%' }}>
                            <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 99, overflow: 'hidden', background: '#f1f5f9' }}>
                              {seg(b.delivered.value, '#16a34a')}{seg(b.returned.value, '#dc2626')}{seg(b.on_way.value + b.waiting.value, CHART.revenue)}
                            </div>
                          </td>
                          <td style={{ ...td, ...num, color: '#15803d' }}>{fmt(b.delivered.value)}<div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{b.delivered.n}</div></td>
                          <td style={{ ...td, ...num, color: b.returned.n ? '#b91c1c' : '#94a3b8' }}>{fmt(b.returned.value)}<div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{b.returned.n}</div></td>
                          <td style={{ ...td, ...num }}>{fmt(b.on_way.value + b.waiting.value)}<div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{b.on_way.n + b.waiting.n}</div></td>
                          <td style={{ ...td, ...num, fontWeight: 700 }}>{r == null ? '—' : `${r.toFixed(0)}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.7rem', color: '#64748b', marginTop: 8, flexWrap: 'wrap' }}>
                  {[['#16a34a', 'Delivered'], ['#dc2626', 'Returned'], [CHART.revenue, 'Still out']].map(([c, l]) => (
                    <span key={l} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}</span>
                  ))}
                  <span>Success = delivered ÷ (delivered + returned). Recent days look low until their parcels finish.</span>
                </div>
              </div>
            )}
          </Card>

          <Card title={`Orders sent (${shown.length})`} subtitle="Tap an order for its details"
            action={
              <label style={{ position: 'relative', flex: '0 1 240px' }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Order, name, phone, consignment…"
                  style={{ ...inputStyle, paddingLeft: 30 }} />
              </label>
            }>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <button type="button" onClick={() => setFilter('all')} style={chip(filter === 'all')}>All <span style={{ opacity: 0.6 }}>{parcels.length}</span></button>
              {(Object.keys(OUTCOME) as DeliveryOutcome[]).filter(k => t[k].n).map(k => (
                <button key={k} type="button" onClick={() => setFilter(k)} style={chip(filter === k)}>{OUTCOME[k].label} <span style={{ opacity: 0.6 }}>{t[k].n}</span></button>
              ))}
            </div>
            {!shown.length ? <EmptyState title="No orders match" /> : (
              <div className="fin-table-scroll">
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th style={th}>Sent</th><th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Status</th><th style={{ ...th, ...num }}>Amount</th><th style={th} /></tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 300).map(p => {
                      const o = OUTCOME[p.outcome];
                      const isOpen = openRow === p.consignmentId;
                      return (
                        <React.Fragment key={p.consignmentId}>
                          <tr onClick={() => setOpenRow(isOpen ? null : p.consignmentId)} style={{ cursor: 'pointer', background: isOpen ? '#f8fafc' : undefined }}>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>{dayLabel(p.date)}</td>
                            <td style={td}><b>{p.orderNumber ? `#${p.orderNumber}` : '—'}</b><div style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>{p.consignmentId}</div></td>
                            <td style={td}>{p.customer || '—'}<div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{p.phone}</div></td>
                            <td style={td}>
                              <span style={{ padding: '2px 8px', borderRadius: 99, background: o.bg, color: o.color, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{o.label}</span>
                              {p.status.toLowerCase() !== o.label.toLowerCase() && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>{p.status}</div>}
                            </td>
                            <td style={{ ...td, ...num, fontWeight: 700 }}>{fmt(p.amount)}</td>
                            <td style={{ ...td, width: 20, color: '#94a3b8' }}>{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                          </tr>
                          {isOpen && (
                            <tr style={{ background: '#f8fafc' }}>
                              <td colSpan={6} style={{ ...td, paddingTop: 0 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 18px', fontSize: '0.78rem', color: '#334155' }}>
                                  <Detail k="Address" v={p.address} />
                                  <Detail k="Items" v={p.items} />
                                  <Detail k="Amount to collect" v={fmt(p.amount)} />
                                  <Detail k="Pathao charge" v={fmt(p.fee)} />
                                  <Detail k="Booked" v={new Date(p.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} />
                                  <Detail k="Last update" v={p.updatedAt ? `${p.status} · ${new Date(p.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : p.status} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {shown.length > 300 && <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '8px 0 0' }}>Showing the latest 300 — narrow the dates or search to see the rest.</p>}
              </div>
            )}
            <p style={{ margin: '10px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
              Live from your Pathao account{data.fetchedAt ? `, fetched ${new Date(data.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}. Amounts are what Pathao collects (cash on delivery).
            </p>
          </Card>
        </>
      )}
    </div>
  );
};

const Detail = ({ k, v }: { k: string; v: string }) => (
  <div><div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>{v || '—'}</div>
);
