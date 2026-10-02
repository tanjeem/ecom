'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import {
  PackageCheck, Truck, Timer, TrendingUp, TrendingDown, Gauge, RefreshCw, AlertTriangle, CheckCircle2, Boxes,
  Zap, ListChecks, Clock, Circle, CheckCircle,
} from 'lucide-react';
import { Card, KpiCard, ErrorState, LoadingState } from '@/components/Finance/ui';
import { fmt, fmtCompact, CHART } from '@/components/Finance/shared';
import { useApi, th, td, num } from '@/components/Finance/useApi';
import { STATUS_LABEL } from '@/lib/orderStatus';
import type { OrderStatus } from '@/lib/types/commerce';

type Ops = {
  asOf: string;
  fulfilment: {
    total: number; value: number; byStatus: { paid: number; packed: number; hold: number };
    age: { under24: number; d1to2: number; over48: number };
    breaches: WaitingOrder[]; onHold: WaitingOrder[];
  };
  courier: {
    open: number; openValue: number; statuses: { status: string; count: number }[];
    stuck: { consignment: string; orderId: string; customer: string; phone: string; status: string; days: number; amount: number; zone: string }[];
    stuckCount: number;
    speed: { median: number | null; p90: number | null; sample: number; byZone: { zone: string; median: number | null; count: number }[] };
    returnRate30: number | null;
  };
  volume: { weeks: { from: string; orders: number }[]; last7PerDay: number; last28PerDay: number; growth: number | null; weekday: { day: number; avg: number }[]; peak: { date: string; orders: number } };
  restock: { id: number; name: string; stock: number; sold30: number; coverDays: number | null; reorder: number; reorderCost: number; urgency: 'now' | 'soon' | 'ok'; sizes: { size: string; stock: number; sold30: number; reorder: number }[] }[];
  stockTotals: { units: number; costValue: number; coverDays: number | null } | null;
  auto: { unitCosts: boolean; accounts: boolean; budgets: boolean };
  settings: { dailyCapacity: number | null; leadTimeDays: number; slaHours: number; checklist: Record<string, boolean> };
  errors: Record<string, string>;
};
type WaitingOrder = { id: string; wooId: number; customer: string; status: OrderStatus; total: number; items: string; created: string; ageHours: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const axisProps = { tick: { fontSize: 11, fill: CHART.axis }, axisLine: false, tickLine: false } as const;
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const ageText = (h: number) => (h < 24 ? `${Math.round(h)}h` : `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`);
const daysText = (d: number | null) => (d == null ? '—' : d < 1 ? `${Math.round(d * 24)}h` : `${d.toFixed(1)} days`);

// Playbook for going from tens to hundreds of orders a day. `auto` items tick themselves from live data.
const PLAYBOOK: { id: string; group: string; title: string; why: string; auto?: keyof Ops['auto'] }[] = [
  { id: 'confirm_cod', group: 'Cut returns', title: 'Confirm every COD order by call or SMS before booking', why: 'The single biggest lever on return rate for COD fashion in Bangladesh.' },
  { id: 'size_chart', group: 'Cut returns', title: 'Size chart with body measurements on every product page', why: 'Wrong size is the top reason for clothing returns.' },
  { id: 'exchange_policy', group: 'Cut returns', title: 'Published exchange policy (size swap instead of return)', why: 'Turns a lost sale and two courier fees into a kept customer.' },
  { id: 'qc_sop', group: 'Fulfilment', title: 'Written packing & QC checklist (stains, threads, size tag, invoice)', why: 'Lets anyone pack correctly, so you can hire without quality dropping.' },
  { id: 'same_day', group: 'Fulfilment', title: 'Same-day dispatch cut-off (e.g. orders before 2 PM ship today)', why: 'Faster delivery means fewer “changed my mind” refusals.' },
  { id: 'backup_courier', group: 'Fulfilment', title: 'Backup courier account (Steadfast / RedX) ready to use', why: 'Pathao outages or delays at peak won’t stop you shipping.' },
  { id: 'reorder_points', group: 'Stock', title: 'Reorder point per best-seller, checked weekly', why: 'Sold-out sizes on winners are the most expensive lost sales.', },
  { id: 'unit_costs', group: 'Stock', title: 'Real unit cost entered for every product', why: 'True per-product profit; decide what to remake or drop.', auto: 'unitCosts' },
  { id: 'drop_calendar', group: 'Growth', title: 'Monthly drop calendar (new styles + content shoot)', why: 'Regular newness drives repeat visits without discounting.' },
  { id: 'winback', group: 'Growth', title: 'WhatsApp/SMS list for past buyers, messaged every drop', why: 'Repeat orders cost almost nothing in ads.' },
  { id: 'accounts', group: 'Money', title: 'Bank, bKash and cash accounts set up in Finance', why: 'Live balances and cash runway.', auto: 'accounts' },
  { id: 'budgets', group: 'Money', title: 'Monthly ad and production budgets set', why: 'Warnings before you overspend.', auto: 'budgets' },
  { id: 'weekly_review', group: 'Money', title: '30-minute weekly numbers review (Finance → Overview)', why: 'Catch a bad week before it becomes a bad month.' },
];

export const ScaleOpsView: React.FC = () => {
  const { data, error, loading, reload } = useApi<Ops>('/api/ops');
  const [settings, setSettings] = useState<Ops['settings'] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => { if (data) setSettings(data.settings); }, [data]);

  const save = async (key: string, value: unknown) => {
    setSaveError(null);
    const r = await fetch('/api/ops', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { setSaveError(j.error || 'Could not save'); return false; }
    return true;
  };

  if (loading && !data) return <section className="view"><LoadingState label="Checking orders, courier and stock…" /></section>;
  if (error && !data) return <section className="view"><ErrorState message="Could not load operations" hint={error} onRetry={() => reload(true)} /></section>;
  if (!data || !settings) return null;

  const { fulfilment: f, courier: c, volume: v } = data;
  const capacity = settings.dailyCapacity;
  const utilisation = capacity ? (v.last7PerDay / capacity) * 100 : null;
  const growthPerWeek = v.growth != null ? v.growth / 4 : null;
  // Weeks until volume hits capacity at the current 4-week growth rate
  const weeksToCapacity = capacity && v.last7PerDay > 0 && v.growth && v.growth > 0 && v.last7PerDay < capacity
    ? Math.log(capacity / v.last7PerDay) / Math.log(1 + v.growth / 100) * 4 : null;
  const weekChart = v.weeks.map(w => ({ ...w, label: shortDate(w.from), perDay: w.orders / 7 }));

  return (
    <section className="view" id="scale-view" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', flex: 1, minWidth: 220 }}>
          What needs doing today, what’s slowing delivery, and what to restock before it runs out.
        </p>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Updated {new Date(data.asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        <button type="button" className="secondary-action" onClick={() => reload(true)} disabled={loading}
          style={{ height: 34, minHeight: 34, padding: '0 12px', fontSize: '0.8rem', borderRadius: 8, gap: 6 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {Object.keys(data.errors).length > 0 && (
        <div role="alert" style={{ padding: '9px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8rem' }}>
          Some data didn’t load: {Object.entries(data.errors).map(([k, e]) => `${k} (${e})`).join('; ')}
        </div>
      )}

      <div className="fin-kpi-grid">
        <KpiCard label="Waiting to ship" icon={PackageCheck} value={f.total.toLocaleString()} tone={f.breaches.length ? 'bad' : f.total ? undefined : 'good'}
          sub={f.breaches.length ? `${f.breaches.length} older than ${settings.slaHours}h` : f.total ? `${fmt(f.value)} · all within ${settings.slaHours}h` : 'Nothing waiting'} />
        <KpiCard label="Out with Pathao" icon={Truck} value={c.open.toLocaleString()} tone={c.stuckCount ? 'warn' : undefined}
          sub={c.stuckCount ? `${c.stuckCount} stuck 5+ days` : `${fmt(c.openValue)} COD in transit`} />
        <KpiCard label="Delivery time" icon={Timer} value={daysText(c.speed.median)}
          sub={c.speed.p90 != null ? `9 in 10 arrive within ${daysText(c.speed.p90)}` : 'Not enough deliveries yet'} />
        <KpiCard label="Orders per day" icon={v.growth != null && v.growth < 0 ? TrendingDown : TrendingUp} value={v.last7PerDay.toFixed(1)}
          delta={v.growth} sub="last 7 days · change vs previous 4 weeks" />
        <KpiCard label="Capacity used" icon={Gauge} value={utilisation != null ? `${Math.round(utilisation)}%` : '—'}
          tone={utilisation == null ? undefined : utilisation > 85 ? 'bad' : utilisation > 65 ? 'warn' : 'good'}
          sub={capacity ? `of ${capacity} orders/day${weeksToCapacity ? ` · full in ~${Math.max(1, Math.round(weeksToCapacity))} weeks` : ''}` : 'Set your daily packing capacity below'} />
      </div>

      <div className="fin-grid-2">
        {/* ── fulfilment ── */}
        <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><PackageCheck size={15} /> Fulfilment queue</span>}
          subtitle={`Orders not yet booked with the courier · target: ship within ${settings.slaHours} hours`}>
          <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', gap: 2, background: '#f1f5f9', marginBottom: 8 }}>
            {[{ n: f.age.under24, c: '#1baf7a' }, { n: f.age.d1to2, c: '#eda100' }, { n: f.age.over48, c: '#dc2626' }].map((s, i) =>
              s.n ? <div key={i} style={{ flex: s.n, background: s.c }} /> : null)}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.76rem', color: '#475569', marginBottom: 12 }}>
            <Legend color="#1baf7a" label={`Under 24h: ${f.age.under24}`} />
            <Legend color="#eda100" label={`1–2 days: ${f.age.d1to2}`} />
            <Legend color="#dc2626" label={`Over 2 days: ${f.age.over48}`} />
            <span style={{ color: '#94a3b8' }}>· {STATUS_LABEL.paid} {f.byStatus.paid} · {STATUS_LABEL.packed} {f.byStatus.packed} · {STATUS_LABEL.hold} {f.byStatus.hold}</span>
          </div>
          {f.breaches.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d', display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={14} /> No order is waiting longer than {settings.slaHours} hours.</p>
          ) : (
            <OrderTable rows={f.breaches} title="Late — ship these first" />
          )}
          {f.onHold.length > 0 && <div style={{ marginTop: 12 }}><OrderTable rows={f.onHold} title="On hold — needs a decision" /></div>}
          <SettingRow label="Target ship time" suffix="hours" value={settings.slaHours} min={4} onSave={async val => { if (await save('ops_sla_hours', val)) { setSettings({ ...settings, slaHours: val! }); reload(true); } }} />
        </Card>

        {/* ── courier ── */}
        <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Truck size={15} /> With the courier</span>}
          subtitle="Pathao parcels from the last 45 days that haven’t been delivered or returned">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {c.statuses.map(s => (
              <span key={s.status} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: '#f1f5f9', color: '#334155' }}>{s.status} · {s.count}</span>
            ))}
            {!c.statuses.length && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No parcels in transit.</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
            {c.speed.byZone.map(z => (
              <div key={z.zone} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700 }}>{z.zone}</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{daysText(z.median)}</div>
                <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{z.count} delivered, 30 days</div>
              </div>
            ))}
          </div>
          {c.returnRate30 != null && (
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: c.returnRate30 > 25 ? '#b91c1c' : '#475569' }}>
              Return rate (last 30 days): <b>{c.returnRate30.toFixed(1)}%</b>{c.returnRate30 > 25 ? ' — calling COD customers before booking usually brings this down fast.' : ''}
            </p>
          )}
          {c.stuck.length > 0 ? (
            <>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#b45309', marginBottom: 6, display: 'flex', gap: 5, alignItems: 'center' }}><AlertTriangle size={13} /> Stuck 5+ days — chase Pathao or call the customer</div>
              <div className="fin-table-scroll" style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                  <thead style={{ position: 'sticky', top: 0 }}><tr><th style={th}>Parcel</th><th style={th}>Customer</th><th style={th}>Status</th><th style={{ ...th, ...num }}>Days</th><th style={{ ...th, ...num }}>COD</th></tr></thead>
                  <tbody>
                    {c.stuck.map(s => (
                      <tr key={s.consignment}>
                        <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem' }}>{s.consignment}{s.orderId && <div style={{ color: '#94a3b8' }}>#{s.orderId}</div>}</td>
                        <td style={td}>{s.customer}<div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{s.phone} · {s.zone}</div></td>
                        <td style={td}>{s.status}</td>
                        <td style={{ ...td, ...num, fontWeight: 700, color: s.days >= 10 ? '#b91c1c' : '#b45309' }}>{s.days}</td>
                        <td style={{ ...td, ...num }}>{fmt(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d', display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={14} /> No parcel has been stuck for 5+ days.</p>}
        </Card>
      </div>

      {/* ── volume ── */}
      <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><TrendingUp size={15} /> Order volume vs capacity</span>}
        subtitle="Orders placed per 7 days (cancelled excluded), last 12 weeks ending today">
        <div className="fin-grid-main">
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekChart} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={8} />
                <YAxis {...axisProps} width={36} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  content={({ active, payload }: any) => active && payload?.length ? (
                    <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '8px 12px', fontSize: '0.76rem', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                      <b>Week of {payload[0].payload.label}</b>
                      <div>{payload[0].value} orders · {payload[0].payload.perDay.toFixed(1)}/day</div>
                    </div>
                  ) : null} />
                {capacity && <ReferenceLine y={capacity * 7} stroke="#dc2626" strokeDasharray="4 3" label={{ value: `Capacity ${capacity * 7}/wk`, position: 'insideTopLeft', fontSize: 10, fill: '#dc2626' }} />}
                <Bar dataKey="orders" name="Orders" radius={[4, 4, 0, 0]} maxBarSize={34}>
                  {weekChart.map(w => <Cell key={w.from} fill={CHART.revenue} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8rem' }}>
            <Fact label="Last 7 days" value={`${v.last7PerDay.toFixed(1)} orders/day`} />
            <Fact label="Last 4 weeks" value={`${v.last28PerDay.toFixed(1)} orders/day`} />
            <Fact label="Growth" value={v.growth != null ? `${v.growth >= 0 ? '+' : ''}${v.growth.toFixed(0)}% vs previous 4 weeks` : '—'} tone={v.growth != null ? (v.growth >= 0 ? '#15803d' : '#b91c1c') : undefined} />
            {v.peak.orders > 0 && <Fact label="Busiest day" value={`${v.peak.orders} orders on ${shortDate(v.peak.date)}`} />}
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, marginBottom: 5 }}>Average by weekday (8 weeks)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 54 }}>
                {v.weekday.map(w => {
                  const max = Math.max(...v.weekday.map(x => x.avg), 0.1);
                  return (
                    <div key={w.day} title={`${WEEKDAYS[w.day]}: ${w.avg.toFixed(1)} orders`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: '100%', height: `${Math.max(3, (w.avg / max) * 40)}px`, background: w.avg === max ? CHART.revenue : '#bfdbfe', borderRadius: 3 }} />
                      <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{WEEKDAYS[w.day][0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <SettingRow label="Packing capacity" suffix="orders/day" value={capacity} min={1} allowClear
              hint="How many orders the team can pack in a day"
              onSave={async val => { if (await save('ops_daily_capacity', val)) setSettings({ ...settings, dailyCapacity: val }); }} />
            {growthPerWeek != null && capacity && utilisation != null && utilisation > 65 && (
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#b45309' }}>You’re using {Math.round(utilisation)}% of packing capacity. Line up extra help before a sale or new drop.</p>
            )}
          </div>
        </div>
      </Card>

      {/* ── restock ── */}
      <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Boxes size={15} /> Restock plan</span>}
        subtitle={`Products that run out before new stock could arrive (${settings.leadTimeDays}-day production lead time), with how many to make to cover lead time + 30 days of sales`}>
        {data.restock.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d', display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={14} /> Every selling product has enough stock to cover the lead time.</p>
        ) : (
          <div className="fin-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr><th style={th}>Product</th><th style={{ ...th, ...num }}>In stock</th><th style={{ ...th, ...num }}>Sold 30d</th><th style={{ ...th, ...num }}>Lasts</th><th style={th}>Make (by size)</th><th style={{ ...th, ...num }}>Make</th><th style={{ ...th, ...num }}>Est. cost</th></tr>
              </thead>
              <tbody>
                {data.restock.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...td, fontWeight: 600, color: '#0f172a' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, marginRight: 7, background: r.urgency === 'now' ? '#dc2626' : '#eda100' }} title={r.urgency === 'now' ? 'Order now' : 'Order soon'} />
                      {r.name}
                    </td>
                    <td style={{ ...td, ...num }}>{r.stock}</td>
                    <td style={{ ...td, ...num }}>{r.sold30}</td>
                    <td style={{ ...td, ...num, fontWeight: 700, color: r.urgency === 'now' ? '#b91c1c' : '#b45309' }}>{r.stock === 0 ? 'Sold out' : r.coverDays != null ? `${Math.round(r.coverDays)} days` : '—'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {r.sizes.map(s => (
                          <span key={s.size} title={`${s.stock} in stock, ${s.sold30} sold in 30 days`} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: s.stock === 0 ? '#fee2e2' : '#fef3c7', color: s.stock === 0 ? '#b91c1c' : '#92400e' }}>
                            {s.size} +{s.reorder}
                          </span>
                        ))}
                        {!r.sizes.length && <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ ...td, ...num, fontWeight: 800 }}>{r.reorder}</td>
                    <td style={{ ...td, ...num }}>{fmt(r.reorderCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <SettingRow label="Production lead time" suffix="days" value={settings.leadTimeDays} min={1}
            onSave={async val => { if (await save('ops_lead_time_days', val)) { setSettings({ ...settings, leadTimeDays: val! }); reload(true); } }} />
          {data.restock.length > 0 && <span style={{ fontSize: '0.78rem', color: '#475569' }}>Total to make: <b>{data.restock.reduce((s, r) => s + r.reorder, 0)} units</b> · ≈ <b>{fmtCompact(data.restock.reduce((s, r) => s + r.reorderCost, 0))}</b> at unit cost</span>}
        </div>
      </Card>

      <div className="fin-grid-2">
        <Automations />
        <Playbook auto={data.auto} checklist={settings.checklist}
          onToggle={async (id, done) => {
            const next = { ...settings.checklist, [id]: done };
            setSettings({ ...settings, checklist: next });
            if (!(await save('ops_checklist', next))) setSettings(settings);
          }} />
      </div>
      {saveError && <div role="alert" style={{ position: 'fixed', bottom: 20, right: 20, background: '#7f1d1d', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem', zIndex: 50 }}>{saveError}</div>}
    </section>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />{label}</span>
);

const Fact = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
    <span style={{ color: '#64748b' }}>{label}</span><b style={{ color: tone || '#0f172a', textAlign: 'right' }}>{value}</b>
  </div>
);

const OrderTable = ({ rows, title }: { rows: WaitingOrder[]; title: string }) => (
  <>
    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>{title}</div>
    <div className="fin-table-scroll" style={{ maxHeight: 240, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <thead style={{ position: 'sticky', top: 0 }}><tr><th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Status</th><th style={{ ...th, ...num }}>Waiting</th><th style={{ ...th, ...num }}>Total</th></tr></thead>
        <tbody>
          {rows.map(o => (
            <tr key={o.id}>
              <td style={{ ...td, fontWeight: 700 }}>{o.id}</td>
              <td style={td}><div>{o.customer}</div><div style={{ color: '#94a3b8', fontSize: '0.7rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.items}>{o.items}</div></td>
              <td style={td}>{STATUS_LABEL[o.status]}</td>
              <td style={{ ...td, ...num, fontWeight: 700, color: o.ageHours >= 72 ? '#b91c1c' : '#b45309' }}>{ageText(o.ageHours)}</td>
              <td style={{ ...td, ...num }}>{fmt(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

/** Inline numeric setting with its own save button. */
const SettingRow = ({ label, suffix, value, min, onSave, allowClear, hint }: {
  label: string; suffix: string; value: number | null; min: number; onSave: (v: number | null) => Promise<void>; allowClear?: boolean; hint?: string;
}) => {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(value == null ? '' : String(value)), [value]);
  const parsed = draft === '' ? null : Number(draft);
  const valid = parsed == null ? !!allowClear : Number.isFinite(parsed) && parsed >= min;
  const dirty = parsed !== value;
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.76rem', color: '#475569', marginTop: 10, flexWrap: 'wrap' }} title={hint}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <input type="number" min={min} value={draft} onChange={e => setDraft(e.target.value)} placeholder="—"
        style={{ width: 70, border: '1px solid #d9dee6', borderRadius: 7, padding: '5px 7px', fontSize: '0.8rem' }} />
      <span>{suffix}</span>
      {dirty && (
        <button type="button" disabled={!valid || busy} onClick={async () => { setBusy(true); await onSave(parsed); setBusy(false); }}
          style={{ border: 'none', borderRadius: 7, padding: '5px 10px', background: valid ? '#0f172a' : '#cbd5e1', color: '#fff', fontWeight: 700, fontSize: '0.74rem', cursor: valid ? 'pointer' : 'default' }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      )}
    </label>
  );
};

const AUTOMATIONS = [
  { name: 'Live parcel status from Pathao', when: 'Instantly', detail: 'Pathao’s webhook updates each order the moment a parcel moves.', on: true },
  { name: 'Daily finance sync', when: '9:00 AM daily', detail: 'Saves new Pathao invoices and posts recurring expenses like rent and salary.', on: true },
  { name: 'Database keep-alive', when: '10:00 AM daily', detail: 'Stops the free Supabase database from pausing.', on: true },
  { name: 'Finance alerts', when: 'Every visit', detail: 'Checks ad spend, returns, margin, payouts and stock; shows them on Finance → Overview.', on: true },
  { name: 'Low-stock messages', when: 'Not set up', detail: 'Send a WhatsApp/SMS or email when a best-seller drops below its reorder point. Needs an SMS or email provider.', on: false },
  { name: 'COD order confirmation SMS', when: 'Not set up', detail: 'Text each COD customer to confirm before booking, which cuts returns. Needs an SMS provider (e.g. SSL Wireless, Alpha SMS).', on: false },
];

const Automations = () => (
  <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Zap size={15} /> Automations</span>} subtitle="Jobs running for you in the background">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {AUTOMATIONS.map(a => (
        <div key={a.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {a.on ? <CheckCircle2 size={16} color="#15803d" style={{ flexShrink: 0, marginTop: 1 }} /> : <Clock size={16} color="#94a3b8" style={{ flexShrink: 0, marginTop: 1 }} />}
          <div style={{ fontSize: '0.8rem', lineHeight: 1.45 }}>
            <b style={{ color: a.on ? '#0f172a' : '#64748b' }}>{a.name}</b>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, marginLeft: 6, padding: '1px 7px', borderRadius: 99, background: a.on ? '#dcfce7' : '#f1f5f9', color: a.on ? '#166534' : '#64748b' }}>{a.when}</span>
            <div style={{ color: '#64748b', fontSize: '0.76rem' }}>{a.detail}</div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const Playbook = ({ auto, checklist, onToggle }: { auto: Ops['auto']; checklist: Record<string, boolean>; onToggle: (id: string, done: boolean) => void }) => {
  const isDone = (i: typeof PLAYBOOK[number]) => (i.auto ? auto[i.auto] : !!checklist[i.id]);
  const done = PLAYBOOK.filter(isDone).length;
  const groups = [...new Set(PLAYBOOK.map(i => i.group))];
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ListChecks size={15} /> Scale-up checklist</span>}
      subtitle="What fashion brands put in place before doubling orders"
      action={<span style={{ fontSize: '0.78rem', fontWeight: 800, color: done === PLAYBOOK.length ? '#15803d' : '#0f172a' }}>{done}/{PLAYBOOK.length}</span>}>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, marginBottom: 12 }}>
        <div style={{ width: `${(done / PLAYBOOK.length) * 100}%`, height: '100%', background: '#1baf7a', borderRadius: 99, transition: 'width 200ms ease' }} />
      </div>
      {groups.map(g => (
        <div key={g} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{g}</div>
          {PLAYBOOK.filter(i => i.group === g).map(i => {
            const d = isDone(i);
            return (
              <button key={i.id} type="button" disabled={!!i.auto} onClick={() => onToggle(i.id, !d)}
                title={i.auto ? 'Ticks itself from your data' : undefined}
                style={{ display: 'flex', gap: 9, alignItems: 'flex-start', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '5px 0', cursor: i.auto ? 'default' : 'pointer' }}>
                {d ? <CheckCircle size={16} color="#15803d" style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={16} color="#cbd5e1" style={{ flexShrink: 0, marginTop: 1 }} />}
                <span style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                  <span style={{ color: d ? '#64748b' : '#0f172a', fontWeight: 600, textDecoration: d ? 'line-through' : undefined }}>{i.title}</span>
                  {i.auto && <span style={{ fontSize: '0.66rem', color: '#94a3b8', marginLeft: 5 }}>auto</span>}
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.72rem' }}>{i.why}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </Card>
  );
};
