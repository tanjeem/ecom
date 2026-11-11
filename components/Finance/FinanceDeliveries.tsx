'use client';

import React, { useMemo, useState } from 'react';
import { Truck, CheckCircle2, RotateCcw, Clock, Search, RefreshCw, Wallet, X, CalendarDays } from 'lucide-react';
import { Card, KpiCard, LoadingState, ErrorState, EmptyState } from './ui';
import { fmt, inputStyle } from './shared';
import { useApi, th, td, num } from './useApi';
import { addDays, todayISO } from '@/lib/finance/periods';
import type { SentParcel, DeliveryOutcome } from '@/app/api/finance/pathao-orders/route';

type Data = { from: string; to: string; fetchedAt: string; parcels: SentParcel[] };
type Group = 'day' | 'week' | 'month';
type Mode = { kind: 'day'; date: string } | { kind: 'last'; days: number } | { kind: 'range'; from: string; to: string };

const OUTCOME: Record<DeliveryOutcome, { label: string; color: string; bg: string; bar: string }> = {
  delivered: { label: 'Delivered', color: '#15803d', bg: '#f0fdf4', bar: '#16a34a' },
  returned: { label: 'Returned', color: '#b91c1c', bg: '#fef2f2', bar: '#dc2626' },
  on_way: { label: 'On the way', color: '#1d4ed8', bg: '#eff6ff', bar: '#3b82f6' },
  waiting: { label: 'Waiting for pickup', color: '#b45309', bg: '#fffbeb', bar: '#f59e0b' },
  cancelled: { label: 'Pickup cancelled', color: '#64748b', bg: '#f1f5f9', bar: '#94a3b8' },
};
const OUTCOME_ORDER: DeliveryOutcome[] = ['waiting', 'on_way', 'delivered', 'returned', 'cancelled'];

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const SHORT_WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
const FULL_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dayLabel = (iso: string) => DAY.format(new Date(`${iso}T00:00:00`));
const weekStart = (iso: string) => addDays(iso, -((new Date(`${iso}T00:00:00`).getDay() + 6) % 7)); // Monday
const bucketOf = (iso: string, g: Group) => (g === 'day' ? iso : g === 'week' ? weekStart(iso) : iso.slice(0, 7));
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type Totals = Record<DeliveryOutcome, { n: number; value: number }> & { sent: number; toCollect: number; collected: number; fees: number };

function totalsOf(ps: SentParcel[]): Totals {
  const t = {
    delivered: { n: 0, value: 0 }, returned: { n: 0, value: 0 }, on_way: { n: 0, value: 0 }, waiting: { n: 0, value: 0 },
    cancelled: { n: 0, value: 0 }, sent: 0, toCollect: 0, collected: 0, fees: 0,
  } as Totals;
  for (const p of ps) {
    t[p.outcome].n++;
    t[p.outcome].value += p.toCollect;
    if (p.outcome === 'cancelled') continue;
    t.sent++;
    t.toCollect += p.toCollect;
    t.collected += p.collected;
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
  const [mode, setMode] = useState<Mode>({ kind: 'day', date: today });
  const [group, setGroup] = useState<Group | 'auto'>('auto');
  const [status, setStatus] = useState<string>('all');
  const [bucket, setBucket] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const from = mode.kind === 'day' ? mode.date : mode.kind === 'last' ? addDays(today, -(mode.days - 1)) : mode.from;
  const to = mode.kind === 'day' ? mode.date : mode.kind === 'last' ? today : mode.to;
  const { data, error, loading, reload } = useApi<Data>(`/api/finance/pathao-orders?from=${from}&to=${to}`);
  const pick = (m: Mode) => { setMode(m); setBucket(null); setStatus('all'); };

  const spanDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const g: Group = group !== 'auto' ? group : spanDays > 92 ? 'month' : spanDays > 31 ? 'week' : 'day';
  const bucketName = (key: string) => {
    if (g === 'month') return MONTH.format(new Date(`${key}-01T00:00:00`));
    if (g === 'week') return `Week of ${dayLabel(key)}`;
    return key === today ? 'Today' : key === addDays(today, -1) ? 'Yesterday' : dayLabel(key);
  };

  const parcels = data?.parcels ?? [];
  const t = useMemo(() => totalsOf(parcels), [parcels]);
  const rate = successRate(t);

  const buckets = useMemo(() => {
    const m = new Map<string, SentParcel[]>();
    for (const p of parcels) {
      const k = bucketOf(p.date, g);
      m.set(k, [...(m.get(k) || []), p]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, ps]) => ({ key, t: totalsOf(ps) }));
  }, [parcels, g]);
  const maxSent = Math.max(1, ...buckets.map(b => b.t.toCollect));

  // Every status Pathao uses in this period, grouped by stage
  const statuses = useMemo(() => {
    const m = new Map<string, { n: number; outcome: DeliveryOutcome }>();
    for (const p of parcels) m.set(p.status, { n: (m.get(p.status)?.n || 0) + 1, outcome: p.outcome });
    return [...m.entries()].sort((a, b) => OUTCOME_ORDER.indexOf(a[1].outcome) - OUTCOME_ORDER.indexOf(b[1].outcome) || b[1].n - a[1].n);
  }, [parcels]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parcels.filter(p =>
      (status === 'all' || p.status === status || p.outcome === status) &&
      (!bucket || bucketOf(p.date, g) === bucket) &&
      (!q || [p.consignmentId, p.orderNumber, p.customer, p.phone, p.address, p.items].some(s => s.toLowerCase().includes(q))));
  }, [parcels, status, bucket, g, query]);
  const shownTotals = useMemo(() => totalsOf(shown), [shown]);

  const chip = (active: boolean) => ({
    border: '1px solid #e2e7ee', borderRadius: 99, padding: '6px 13px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    background: active ? '#0f172a' : '#fff', color: active ? '#fff' : '#334155',
  } as const);
  const isDay = (d: string) => mode.kind === 'day' && mode.date === d;
  const isLast = (n: number) => mode.kind === 'last' && mode.days === n;
  const dateInput = { border: 'none', outline: 'none', padding: '7px 10px', fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', background: 'transparent', fontFamily: 'inherit' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* period picker */}
      <Card padding="12px 14px">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[0, 1, 2, 3, 4].map(n => {
            const d = addDays(today, -n);
            const on = isDay(d);
            return (
              <button key={d} type="button" onClick={() => pick({ kind: 'day', date: d })}
                style={{ ...chip(on), display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15, padding: '5px 13px', minWidth: 74 }}>
                <span>{n === 0 ? 'Today' : n === 1 ? 'Yesterday' : SHORT_WEEKDAY.format(new Date(`${d}T00:00:00`))}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: on ? 0.75 : 0.55 }}>{SHORT_DATE.format(new Date(`${d}T00:00:00`))}</span>
              </button>
            );
          })}
          <span style={{ width: 1, height: 30, background: '#e2e7ee', margin: '0 4px' }} />
          {([['Last 7 days', 7], ['Last 14 days', 14]] as const).map(([l, n]) => (
            <button key={n} type="button" onClick={() => pick({ kind: 'last', days: n })} style={{ ...chip(isLast(n)), padding: '12px 13px' }}>{l}</button>
          ))}
          <button type="button" onClick={() => pick({ kind: 'range', from: `${today.slice(0, 7)}-01`, to: today })}
            style={{ ...chip(mode.kind === 'range' && mode.from === `${today.slice(0, 7)}-01` && mode.to === today), padding: '12px 13px' }}>This month</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => reload(true)} disabled={loading} title="Fetch the latest from Pathao"
            style={{ ...chip(false), display: 'inline-flex', gap: 6, alignItems: 'center', padding: '12px 13px' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> {loading ? 'Fetching…' : 'Fetch from Pathao'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', color: '#64748b', fontSize: '0.74rem', fontWeight: 700, borderRight: '1px solid #e2e7ee', alignSelf: 'stretch', background: '#f8fafc' }}>
              <CalendarDays size={14} /> Dates
            </span>
            <input type="date" aria-label="From" value={from} max={to} onChange={e => e.target.value && pick({ kind: 'range', from: e.target.value, to })} style={dateInput} />
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>→</span>
            <input type="date" aria-label="To" value={to} min={from} max={today} onChange={e => e.target.value && pick({ kind: 'range', from, to: e.target.value })} style={dateInput} />
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing <b style={{ color: '#0f172a' }}>{from === to ? FULL_DATE.format(new Date(`${from}T00:00:00`)) : `${dayLabel(from)} – ${dayLabel(to)}`}</b>
            {from !== to && ` · ${spanDays} days`}
          </span>
        </div>
      </Card>

      {error && !data ? <ErrorState message="Could not load Pathao orders" hint={error} onRetry={() => reload(true)} />
        : !data || (loading && (data.from !== from || data.to !== to)) ? <LoadingState label="Fetching orders from Pathao…" />
        : (
        <>
          {spanDays > 45 && parcels.length > 0 && parcels[parcels.length - 1].date > addDays(from, 14) && (
            <p style={{ margin: 0, padding: '9px 12px', background: '#fffbeb', borderRadius: 9, fontSize: '0.76rem', color: '#92400e' }}>
              Pathao only keeps about the last 7 weeks of parcels. The earliest one it returned is from {dayLabel(parcels[parcels.length - 1].date)}, so totals before that are missing.
            </p>
          )}
          <div className="fin-kpi-grid">
            <KpiCard label="Sent (to collect)" icon={Truck} value={fmt(t.toCollect)} sub={`${t.sent} parcels sent on Pathao`} />
            <KpiCard label="Collected" icon={Wallet} tone="good" value={fmt(t.collected)}
              sub={t.toCollect ? `${Math.round((t.collected / t.toCollect) * 100)}% of what was sent · Pathao charge ${fmt(t.fees)}` : 'nothing sent'} />
            <KpiCard label="Delivered" icon={CheckCircle2} value={String(t.delivered.n)} sub={`parcels · worth ${fmt(t.delivered.value)}`}
              onClick={t.delivered.n ? () => setStatus('delivered') : undefined} />
            <KpiCard label="Returned" icon={RotateCcw} tone={t.returned.n ? 'bad' : undefined} value={String(t.returned.n)}
              sub={`parcels · worth ${fmt(t.returned.value)}`} onClick={t.returned.n ? () => setStatus('returned') : undefined} />
            <KpiCard label="Still out" icon={Clock} value={String(t.on_way.n + t.waiting.n)}
              sub={`${t.on_way.n} on the way · ${t.waiting.n} waiting for pickup`} />
            <KpiCard label="Delivery success" value={rate == null ? '—' : `${rate.toFixed(0)}%`}
              tone={rate == null ? undefined : rate >= 85 ? 'good' : rate >= 70 ? 'warn' : 'bad'}
              sub="delivered ÷ (delivered + returned)" />
          </div>

          {spanDays > 1 && (
            <Card title="Day by day" subtitle="By the day each parcel was booked · tap a day to see its orders below"
              action={
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['auto', 'day', 'week', 'month'] as const).map(x => (
                    <button key={x} type="button" onClick={() => { setGroup(x); setBucket(null); }} style={{ ...chip(group === x), padding: '4px 10px', fontSize: '0.72rem' }}>
                      {x === 'auto' ? 'Auto' : x[0].toUpperCase() + x.slice(1)}
                    </button>
                  ))}
                </div>
              }>
              {!buckets.length ? <EmptyState title="No parcels sent in this period" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {buckets.map(({ key, t: b }) => {
                    const r = successRate(b);
                    const on = bucket === key;
                    return (
                      <button key={key} type="button" onClick={() => setBucket(on ? null : key)}
                        style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 150px) minmax(0, 1fr)', gap: 14, alignItems: 'center', textAlign: 'left',
                          padding: '12px 14px', borderRadius: 10, cursor: 'pointer', font: 'inherit',
                          border: `1px solid ${on ? '#0f172a' : '#eef1f5'}`, background: on ? '#f8fafc' : '#fff' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.86rem' }}>{bucketName(key)}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{b.sent} parcels{r != null ? ` · ${r.toFixed(0)}% success` : ''}</div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: '0.78rem', marginBottom: 6 }}>
                            <span><span style={{ color: '#64748b' }}>Sent </span><b style={{ color: '#0f172a' }}>{fmt(b.toCollect)}</b></span>
                            <span><span style={{ color: '#64748b' }}>Collected </span><b style={{ color: '#15803d' }}>{fmt(b.collected)}</b></span>
                          </div>
                          <div style={{ display: 'flex', gap: 2, height: 10, borderRadius: 99, overflow: 'hidden', background: '#f1f5f9', width: `${Math.max(8, (b.toCollect / maxSent) * 100)}%` }}>
                            {(['delivered', 'returned', 'on_way', 'waiting'] as const).map(k => b[k].value > 0 && (
                              <span key={k} title={`${OUTCOME[k].label}: ${b[k].n}`} style={{ flex: b[k].value, background: OUTCOME[k].bar }} />
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.72rem', color: '#64748b', marginTop: 6 }}>
                            {(['delivered', 'returned', 'on_way', 'waiting', 'cancelled'] as const).filter(k => b[k].n).map(k => (
                              <span key={k} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                                <span style={{ width: 8, height: 8, borderRadius: 99, background: OUTCOME[k].bar }} />
                                <b style={{ color: '#334155' }}>{b[k].n}</b> {OUTCOME[k].label.toLowerCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          <Card title={`Orders sent${bucket ? ` · ${bucketName(bucket)}` : ''}`}
            subtitle={`${shown.length} parcels · ${fmt(shownTotals.toCollect)} to collect · ${fmt(shownTotals.collected)} collected`}
            action={
              <label style={{ position: 'relative', flex: '0 1 260px' }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Order, name, phone, address, item…"
                  style={{ ...inputStyle, paddingLeft: 30 }} />
              </label>
            }>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <button type="button" onClick={() => setStatus('all')} style={chip(status === 'all')}>All <span style={{ opacity: 0.6 }}>{parcels.length}</span></button>
              {statuses.map(([s, { n, outcome }]) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  style={{ ...chip(status === s), display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: OUTCOME[outcome].bar }} />
                  {s} <span style={{ opacity: 0.6 }}>{n}</span>
                </button>
              ))}
              {bucket && (
                <button type="button" onClick={() => setBucket(null)} style={{ ...chip(false), display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <X size={12} /> {bucketName(bucket)}
                </button>
              )}
            </div>
            {!shown.length ? <EmptyState title={parcels.length ? 'No orders match' : 'No parcels sent on Pathao in this period'} /> : (
              <div className="fin-table-scroll">
                <table style={{ width: '100%', minWidth: 1040, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 80 }} /><col style={{ width: 138 }} /><col style={{ width: 120 }} /><col /><col style={{ width: '13%' }} />
                    <col style={{ width: 170 }} /><col style={{ width: 108 }} /><col style={{ width: 108 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={th}>Sent</th><th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Address</th>
                      <th style={th}>Items</th><th style={th}>Status</th>
                      <th style={{ ...th, ...num }}>To collect</th><th style={{ ...th, ...num }}>Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 400).map(p => {
                      const o = OUTCOME[p.outcome];
                      return (
                        <tr key={p.consignmentId} style={{ verticalAlign: 'top' }}>
                          <td style={{ ...td, ...wrap, fontSize: '0.76rem' }}>{when(p.createdAt)}</td>
                          <td style={td}>
                            <b style={{ display: 'block' }}>{p.orderNumber ? `#${p.orderNumber}` : 'No order no.'}</b>
                            <a href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(p.consignmentId)}`} target="_blank" rel="noopener noreferrer"
                              title="Open in the Pathao merchant panel"
                              style={{ display: 'block', whiteSpace: 'nowrap', fontSize: '0.68rem', color: '#2563eb', fontFamily: 'ui-monospace, monospace', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                              {p.consignmentId} ↗
                            </a>
                          </td>
                          <td style={{ ...td, ...wrap }}>{p.customer || '—'}<div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{p.phone}</div></td>
                          <td style={{ ...td, ...wrap, fontSize: '0.7rem', lineHeight: 1.35, color: '#64748b' }}>{p.address || '—'}</td>
                          <td style={{ ...td, ...wrap, fontSize: '0.7rem', lineHeight: 1.35, color: '#64748b' }}>{p.items || '—'}</td>
                          <td style={{ ...td, ...wrap }}>
                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 12, background: o.bg, color: o.color, fontSize: '0.78rem', fontWeight: 800, lineHeight: 1.3 }}>{p.status}</span>
                            {p.updatedAt && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>{when(p.updatedAt)}</div>}
                          </td>
                          <td style={{ ...td, ...num, fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }} title={p.toCollectKnown ? undefined : 'Pathao replaced the original amount; this is what it shows now'}>
                            {fmt(p.toCollect)}{!p.toCollectKnown && <div style={{ fontSize: '0.64rem', color: '#b45309', fontWeight: 600 }}>original unknown</div>}
                          </td>
                          <td style={{ ...td, ...num, fontWeight: 800, fontSize: '0.95rem', color: p.collected ? '#15803d' : '#94a3b8' }}>{fmt(p.collected)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {shown.length > 400 && <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '8px 0 0' }}>Showing the latest 400 — pick fewer days or search to see the rest.</p>}
              </div>
            )}
            <p style={{ margin: '10px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
              Live from your Pathao account, fetched {new Date(data.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
              To collect is the amount the parcel was booked with on Pathao. Collected is what Pathao got: the full amount when delivered, the return charge on a paid return, nothing while out or on a plain return.
            </p>
          </Card>
        </>
      )}
    </div>
  );
};

const wrap = { overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' } as const;
