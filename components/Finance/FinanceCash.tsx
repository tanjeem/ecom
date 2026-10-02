'use client';

import React, { useMemo, useState } from 'react';
import { Wallet, Truck, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Clock, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { addDays, daysInMonth } from '@/lib/finance/periods';
import { fmt, fmtCompact, CHART, btnPrimary, btnSecondary, selectStyle, PAYMENT_METHODS } from './shared';
import { Card, KpiCard, LoadingState, ErrorState, useToasts, ToastStack } from './ui';
import { useApi, th, td, num } from './useApi';
import { invalidateFinanceCache } from './period';

type Forecast = {
  asOf: string;
  start: { cash: number; accounts: number; vendorDue: number };
  pipeline: {
    holding: { inReview: number; preparing: number; inProcess: number; lastPayment: { amount: number; date: string | null; method: string | null }; lifetime: number } | null;
    holdingTotal: number;
    transit: { count: number; cod: number; fees: number; returnRate: number; expected: number };
  };
  rates: { payoutsPerDay: number; metaPerDay: number; productionPerDay: number; replenishPerDay: number; otherPerDay: number };
  monthlyFixed: { name: string; category: string; amount: number }[];
  recurring: { description: string; type: string; amount: number; day: number; start: string; end: string | null }[];
};

type Scenario = { sales: number; ads: number; restock: boolean; oneOff: number; oneOffDay: number };

const axisProps = { tick: { fontSize: 11, fill: CHART.axis }, axisLine: false, tickLine: false } as const;
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

type Line = 'payouts' | 'ads' | 'production' | 'fixed' | 'other' | 'recurringIn' | 'recurringOut' | 'oneOff' | 'vendors';

/** Day-by-day projection. Payouts assume the last 60 days' pace continues (they already include what Pathao owes today). */
function project(f: Forecast, s: Scenario) {
  const salesK = 1 + s.sales / 100;
  const production = s.restock ? Math.max(f.rates.productionPerDay, f.rates.replenishPerDay * salesK) : f.rates.productionPerDay;
  const fixedMonthly = f.monthlyFixed.reduce((t, x) => t + x.amount, 0);
  let bal = f.start.cash;
  const points: { date: string; label: string; balance: number }[] = [{ date: f.asOf, label: shortDate(f.asOf), balance: bal }];
  const marks: Record<30 | 60 | 90, Record<Line, number> & { balance: number }> = {} as any;
  const acc: Record<Line, number> = { payouts: 0, ads: 0, production: 0, fixed: 0, other: 0, recurringIn: 0, recurringOut: 0, oneOff: 0, vendors: 0 };
  let low = { date: f.asOf, balance: bal };

  for (let d = 1; d <= 90; d++) {
    const date = addDays(f.asOf, d);
    const month = date.slice(0, 7);
    const day = Number(date.slice(8, 10));
    const flows: Partial<Record<Line, number>> = {
      payouts: f.rates.payoutsPerDay * salesK,
      ads: f.rates.metaPerDay * (1 + s.ads / 100),
      production,
      fixed: fixedMonthly / daysInMonth(date),
      other: f.rates.otherPerDay,
    };
    for (const r of f.recurring) {
      if (r.day !== day || month < r.start || (r.end && month > r.end)) continue;
      if (r.type === 'income') flows.recurringIn = (flows.recurringIn || 0) + r.amount;
      else if (r.type === 'expense') flows.recurringOut = (flows.recurringOut || 0) + r.amount;
    }
    if (s.oneOff > 0 && d === s.oneOffDay) flows.oneOff = s.oneOff;
    if (d === 7 && f.start.vendorDue > 0) flows.vendors = f.start.vendorDue; // assume dues are settled within a week

    for (const [k, v] of Object.entries(flows) as [Line, number][]) acc[k] += v;
    bal += (flows.payouts || 0) + (flows.recurringIn || 0)
      - (flows.ads || 0) - (flows.production || 0) - (flows.fixed || 0) - (flows.other || 0) - (flows.recurringOut || 0) - (flows.oneOff || 0) - (flows.vendors || 0);
    points.push({ date, label: shortDate(date), balance: bal });
    if (bal < low.balance) low = { date, balance: bal };
    if (d === 30 || d === 60 || d === 90) marks[d] = { ...acc, balance: bal };
  }
  return { points, marks, low, production };
}

const Slider = ({ label, value, min, max, step = 5, onChange, suffix = '%' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem', color: '#475569', minWidth: 150, flex: '1 1 150px' }}>
    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <b style={{ color: value > 0 ? '#15803d' : value < 0 ? '#b91c1c' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{value > 0 ? '+' : ''}{value}{suffix}</b>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ accentColor: '#2a78d6' }} />
  </label>
);

export const FinanceCash: React.FC<{ onOpenTab?: (t: string) => void }> = ({ onOpenTab }) => {
  const { data: f, error, loading, reload } = useApi<Forecast>('/api/finance/forecast');
  const [s, setS] = useState<Scenario>({ sales: 0, ads: 0, restock: true, oneOff: 0, oneOffDay: 15 });

  const proj = useMemo(() => (f ? project(f, s) : null), [f, s]);

  if (loading && !f) return <LoadingState label="Building cash forecast…" />;
  if (error && !f) return <ErrorState message={error} onRetry={() => reload(true)} />;
  if (!f || !proj) return null;

  const hasAccounts = f.start.accounts > 0;
  const changed = s.sales !== 0 || s.ads !== 0 || !s.restock || s.oneOff > 0;
  const holding = f.pipeline.holding;
  const owed = f.pipeline.holdingTotal + f.pipeline.transit.expected;
  const lowNegative = proj.low.balance < 0;
  const balanceLabel = hasAccounts ? 'Projected cash' : 'Cash change from today';

  const rows: { label: string; key: Line; sign: 1 | -1; hint?: string }[] = [
    { label: 'Pathao payouts', key: 'payouts', sign: 1, hint: `${fmt(f.rates.payoutsPerDay)}/day, last 60 days` },
    { label: 'Recurring income', key: 'recurringIn', sign: 1 },
    { label: 'Meta ads', key: 'ads', sign: -1, hint: `${fmt(f.rates.metaPerDay)}/day, last 60 days` },
    { label: s.restock ? 'Production (restock what sells)' : 'Production purchases', key: 'production', sign: -1, hint: `${fmt(proj.production)}/day` },
    { label: 'Fixed costs', key: 'fixed', sign: -1, hint: `${fmt(f.monthlyFixed.reduce((t, x) => t + x.amount, 0))}/month` },
    { label: 'Other spending', key: 'other', sign: -1, hint: '90-day average' },
    { label: 'Recurring expenses', key: 'recurringOut', sign: -1 },
    { label: 'Vendor dues', key: 'vendors', sign: -1 },
    { label: 'One-off expense', key: 'oneOff', sign: -1 },
  ];
  const visibleRows = rows.filter(r => r.key === 'payouts' || proj.marks[90][r.key] > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="fin-kpi-grid">
        <KpiCard label="Cash today" icon={Wallet} value={hasAccounts ? fmt(f.start.cash) : '—'}
          sub={hasAccounts ? `${f.start.accounts} account${f.start.accounts > 1 ? 's' : ''}` : 'Add accounts in Settings to track balances'}
          onClick={onOpenTab && !hasAccounts ? () => onOpenTab('settings') : undefined} />
        <KpiCard label="Pathao owes you" icon={Truck} value={fmt(owed)}
          sub={`${fmt(f.pipeline.holdingTotal)} invoiced + ~${fmt(f.pipeline.transit.expected)} on ${f.pipeline.transit.count} parcels in transit`} />
        <KpiCard label={hasAccounts ? 'Cash in 30 days' : 'Net cash, next 30 days'} icon={proj.marks[30].balance - f.start.cash >= 0 ? TrendingUp : TrendingDown}
          value={fmt(proj.marks[30].balance)} tone={proj.marks[30].balance - f.start.cash >= 0 ? 'good' : 'bad'}
          sub={`${fmt(proj.marks[90].balance)} in 90 days`} />
        <KpiCard label="Lowest point (90 days)" icon={lowNegative ? AlertTriangle : CheckCircle2}
          value={fmt(proj.low.balance)} tone={lowNegative ? 'bad' : 'good'}
          sub={proj.low.date === f.asOf ? 'Today — cash only grows from here' : `on ${shortDate(proj.low.date)}`} />
      </div>

      <Card
        title="90-day cash forecast"
        subtitle={hasAccounts ? 'Starts from today’s account balances' : 'No accounts set up, so this shows how much cash you gain or lose from today'}
        action={<button type="button" onClick={() => reload(true)} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '0.74rem', display: 'inline-flex', gap: 5, alignItems: 'center' }}><RefreshCw size={12} /> Refresh</button>}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: '10px 12px', background: '#f8fafc', borderRadius: 10, marginBottom: 14, alignItems: 'flex-end' }}>
          <Slider label="Sales" value={s.sales} min={-50} max={50} onChange={v => setS({ ...s, sales: v })} />
          <Slider label="Ad spend" value={s.ads} min={-100} max={100} step={10} onChange={v => setS({ ...s, ads: v })} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem', color: '#475569', flex: '1 1 170px' }}>
            <span style={{ fontWeight: 700 }}>One-off expense</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <input type="number" min={0} step={1000} value={s.oneOff || ''} placeholder="৳ amount" onChange={e => setS({ ...s, oneOff: Math.max(0, Number(e.target.value) || 0) })}
                style={{ ...selectStyle, width: 110, padding: '6px 8px' }} />
              <select value={s.oneOffDay} onChange={e => setS({ ...s, oneOffDay: Number(e.target.value) })} style={{ ...selectStyle, padding: '6px 8px' }}>
                {[1, 7, 15, 30, 45, 60, 75, 90].map(d => <option key={d} value={d}>in {d} day{d > 1 ? 's' : ''}</option>)}
              </select>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.76rem', color: '#334155', fontWeight: 600, paddingBottom: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={s.restock} onChange={e => setS({ ...s, restock: e.target.checked })} />
            Restock what sells
          </label>
          {changed && <button type="button" onClick={() => setS({ sales: 0, ads: 0, restock: true, oneOff: 0, oneOffDay: 15 })} style={{ ...btnSecondary, padding: '6px 10px', fontSize: '0.74rem' }}>Reset</button>}
        </div>

        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={proj.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.revenue} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART.revenue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={28} />
              <YAxis {...axisProps} width={60} tickFormatter={fmtCompact} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              {[30, 60].map(d => <ReferenceLine key={d} x={proj.points[d].label} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: `${d}d`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }} />)}
              <Tooltip
                cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                content={({ active, payload }: any) => active && payload?.length ? (
                  <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '8px 12px', fontSize: '0.76rem', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>{shortDate(payload[0].payload.date)}</div>
                    <div style={{ color: '#334155' }}>{balanceLabel}: <b style={{ color: payload[0].value < 0 ? '#b91c1c' : '#0f172a' }}>{fmt(payload[0].value)}</b></div>
                  </div>
                ) : null}
              />
              <Area type="monotone" dataKey="balance" name={balanceLabel} stroke={CHART.revenue} strokeWidth={2} fill="url(#cashFill)" dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="fin-table-scroll" style={{ marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr><th style={th}>Where the money goes</th><th style={{ ...th, ...num }}>Next 30 days</th><th style={{ ...th, ...num }}>60 days</th><th style={{ ...th, ...num }}>90 days</th></tr>
            </thead>
            <tbody>
              {visibleRows.map(r => (
                <tr key={r.key}>
                  <td style={td}>{r.label}{r.hint && <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> · {r.hint}</span>}</td>
                  {([30, 60, 90] as const).map(d => (
                    <td key={d} style={{ ...td, ...num, color: r.sign > 0 ? '#15803d' : '#334155' }}>{r.sign > 0 ? '+' : '−'}{fmt(proj.marks[d][r.key])}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 800, color: '#0f172a' }}>{balanceLabel}</td>
                {([30, 60, 90] as const).map(d => (
                  <td key={d} style={{ ...td, ...num, fontWeight: 800, color: proj.marks[d].balance < 0 ? '#b91c1c' : '#0f172a' }}>{fmt(proj.marks[d].balance)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.5 }}>
          Assumes Pathao keeps paying at the last 60 days’ pace (that already includes the money it owes you today), ads continue at the recent daily spend, and fixed costs are paid evenly.
          {s.restock && ' “Restock what sells” budgets production to replace the units you sell, at their unit cost.'}
        </p>
      </Card>

      <div className="fin-grid-2">
        <PathaoHoldingCard holding={holding} transit={f.pipeline.transit} />
        <FixedOutgoingsCard f={f} onOpenTab={onOpenTab} />
      </div>

      <PayoutCheck />
    </div>
  );
};

const PathaoHoldingCard = ({ holding, transit }: { holding: Forecast['pipeline']['holding']; transit: Forecast['pipeline']['transit'] }) => {
  const rows = holding ? [
    { label: 'In review', sub: 'Pathao is checking the deliveries', amount: holding.inReview },
    { label: 'Preparing invoice', sub: 'Invoice being raised', amount: holding.preparing },
    { label: 'Payment in process', sub: 'On its way to you', amount: holding.inProcess },
  ] : [];
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Truck size={15} /> Money with Pathao</span>} subtitle="Live from Pathao">
      {!holding && <p style={{ margin: 0, fontSize: '0.8rem', color: '#b45309' }}>Pathao’s invoice summary is unavailable right now.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.8rem' }}>
            <span style={{ color: '#334155' }}>{r.label}<span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> · {r.sub}</span></span>
            <b style={{ fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>{fmt(r.amount)}</b>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.8rem' }}>
          <span style={{ color: '#334155' }}>In transit (expected)<span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> · {transit.count} parcels, {fmt(transit.cod)} COD less {Math.round(transit.returnRate)}% returns and fees</span></span>
          <b style={{ fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>{fmt(transit.expected)}</b>
        </div>
      </div>
      {holding && (
        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 12, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.76rem', color: '#64748b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Last payout</span><b style={{ color: '#0f172a' }}>{fmt(holding.lastPayment.amount)}{holding.lastPayment.date && ` · ${holding.lastPayment.date}`}{holding.lastPayment.method && ` · ${holding.lastPayment.method}`}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Lifetime paid by Pathao</span><b style={{ color: '#0f172a' }}>{fmt(holding.lifetime)}</b></div>
        </div>
      )}
    </Card>
  );
};

const FixedOutgoingsCard = ({ f, onOpenTab }: { f: Forecast; onOpenTab?: (t: string) => void }) => {
  const total = f.monthlyFixed.reduce((t, x) => t + x.amount, 0);
  const recurringOut = f.recurring.filter(r => r.type === 'expense');
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Clock size={15} /> Monthly commitments</span>}
      subtitle="Fixed costs and recurring payments in the forecast"
      action={onOpenTab && <button type="button" onClick={() => onOpenTab('fixed-costs')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center' }}><SettingsIcon size={12} /> Edit</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {f.monthlyFixed.map(x => (
          <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: '#334155' }}>{x.name}</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(x.amount)}</b>
          </div>
        ))}
        {recurringOut.map(r => (
          <div key={r.description} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: '#334155' }}>{r.description}<span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> · on the {r.day}{r.day === 1 ? 'st' : r.day === 2 ? 'nd' : r.day === 3 ? 'rd' : 'th'}</span></span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.amount)}</b>
          </div>
        ))}
        {!f.monthlyFixed.length && !recurringOut.length && <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No fixed costs set up yet.</p>}
      </div>
      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
        <span style={{ color: '#64748b' }}>Total per month</span>
        <b>{fmt(total + recurringOut.reduce((t, r) => t + r.amount, 0))}</b>
      </div>
    </Card>
  );
};

// ─── Pathao payout check ─────────────────────────────────────────────────────

type PayoutRow = {
  id: string; created: string; paid: string | null; collected: number; fees: number; payout: number; deliveries: number; returns: number;
  status: 'confirmed' | 'mismatch' | 'pending' | 'unconfirmed' | 'unconfirmed_old';
  confirmation: { id: string; date: string; amount: number; method: string } | null;
};
type Payouts = { invoices: PayoutRow[]; unmatchedDeposits: { id: string; date: string; amount: number; description: string }[]; totals: { paid: number; confirmed: number; unconfirmed: number; pending: number; count: number } };

const STATUS: Record<PayoutRow['status'], { label: string; bg: string; color: string }> = {
  confirmed: { label: 'Received', bg: '#dcfce7', color: '#166534' },
  mismatch: { label: 'Amount differs', bg: '#fee2e2', color: '#b91c1c' },
  pending: { label: 'Not paid yet', bg: '#f1f5f9', color: '#475569' },
  unconfirmed: { label: 'To confirm', bg: '#fef3c7', color: '#92400e' },
  unconfirmed_old: { label: 'Check bank', bg: '#ffedd5', color: '#9a3412' },
};

const PayoutCheck = () => {
  const { data, error, loading, reload } = useApi<Payouts>('/api/finance/payouts');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<string>('bKash');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const { toasts, push, dismiss } = useToasts();

  const confirm = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await fetch('/api/finance/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_ids: ids, payment_method: method }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Failed');
      push({ text: `${j.created} payout${j.created === 1 ? '' : 's'} marked as received in ${method}` });
      setSelected(new Set());
      invalidateFinanceCache();
      reload();
    } catch (e: any) {
      push({ text: e.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const open = (data?.invoices || []).filter(i => i.status === 'unconfirmed' || i.status === 'unconfirmed_old' || i.status === 'mismatch');
  const list = filter === 'open' ? open : data?.invoices || [];
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Card
      title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={15} /> Pathao payout check</span>}
      subtitle="Tick off each Pathao payout once you see it in your bKash or bank, so a missing transfer never slips by"
      action={
        <div style={{ display: 'flex', gap: 6 }}>
          {(['open', 'all'] as const).map(k => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              style={{ ...btnSecondary, padding: '5px 10px', fontSize: '0.72rem', background: filter === k ? '#0f172a' : '#fff', color: filter === k ? '#fff' : '#334155' }}>
              {k === 'open' ? `To confirm (${open.length})` : 'All (90 days)'}
            </button>
          ))}
        </div>
      }
    >
      {loading && !data && <div className="fin-loading-bar" />}
      {error && <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.8rem' }}>{error}</p>}
      {data && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.78rem', color: '#64748b', marginBottom: 12 }}>
            <span>Paid by Pathao: <b style={{ color: '#0f172a' }}>{fmt(data.totals.paid)}</b></span>
            <span>Confirmed received: <b style={{ color: '#15803d' }}>{fmt(data.totals.confirmed)}</b></span>
            <span>Still to confirm: <b style={{ color: data.totals.unconfirmed ? '#b45309' : '#0f172a' }}>{fmt(data.totals.unconfirmed)}</b></span>
          </div>
          {open.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.76rem', color: '#475569' }}>Received in</span>
              <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...selectStyle, width: 'auto', padding: '5px 8px' }}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
              <button type="button" disabled={busy || !selected.size} onClick={() => confirm([...selected])} style={{ ...btnPrimary, padding: '6px 12px', fontSize: '0.76rem', opacity: busy || !selected.size ? 0.5 : 1 }}>
                Mark {selected.size || ''} received
              </button>
              <button type="button" disabled={busy} onClick={() => confirm(open.filter(i => i.status !== 'mismatch').map(i => i.id))} style={{ ...btnSecondary, padding: '6px 12px', fontSize: '0.76rem' }}>
                All {open.filter(i => i.status !== 'mismatch').length} arrived
              </button>
            </div>
          )}
          {list.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d', display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={14} /> Every Pathao payout in the last 90 days is confirmed.</p>
          ) : (
            <div className="fin-table-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ ...th, width: 30 }} />
                    <th style={th}>Invoice</th><th style={th}>Paid on</th><th style={{ ...th, ...num }}>Parcels</th>
                    <th style={{ ...th, ...num }}>Collected</th><th style={{ ...th, ...num }}>Fees</th><th style={{ ...th, ...num }}>Payout</th><th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(i => {
                    const st = STATUS[i.status];
                    const selectable = i.status === 'unconfirmed' || i.status === 'unconfirmed_old';
                    return (
                      <tr key={i.id} className="fin-row">
                        <td style={td}>{selectable && <input type="checkbox" aria-label={`Select ${i.id}`} checked={selected.has(i.id)} onChange={() => toggle(i.id)} />}</td>
                        <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem' }}>{i.id}</td>
                        <td style={td}>{i.paid ? shortDate(i.paid) : '—'}</td>
                        <td style={{ ...td, ...num }}>{i.deliveries}{i.returns ? <span style={{ color: '#b91c1c' }}> +{i.returns}↩</span> : ''}</td>
                        <td style={{ ...td, ...num }}>{fmt(i.collected)}</td>
                        <td style={{ ...td, ...num, color: '#94a3b8' }}>−{fmt(i.fees)}</td>
                        <td style={{ ...td, ...num, fontWeight: 700, color: '#0f172a' }}>{fmt(i.payout)}</td>
                        <td style={td}>
                          <span title={i.confirmation ? `${fmt(i.confirmation.amount)} on ${i.confirmation.date} via ${i.confirmation.method}` : undefined}
                            style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: 99, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.unmatchedDeposits.length > 0 && (
            <p style={{ margin: '10px 0 0', fontSize: '0.74rem', color: '#b45309' }}>
              {data.unmatchedDeposits.length} logged Pathao deposit{data.unmatchedDeposits.length > 1 ? 's don’t' : ' doesn’t'} match any invoice: {data.unmatchedDeposits.slice(0, 3).map(d => `${fmt(d.amount)} on ${d.date}`).join(', ')}.
            </p>
          )}
        </>
      )}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </Card>
  );
};
