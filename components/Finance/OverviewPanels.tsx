'use client';

import React, { useEffect, useState } from 'react';
import { Wallet, Target, Settings as SettingsIcon, AlertTriangle, ArrowRight } from 'lucide-react';
import { COST_GROUPS, type FinanceSummary } from '@/lib/finance/types';
import type { PeriodRange } from '@/lib/finance/periods';
import { budgetForRange, type Budget } from '@/lib/finance/budget';
import { fmt, fmtCompact, CHART } from './shared';
import { Card } from './ui';

type Position = {
  accounts: { id: string; name: string; kind: string; balance: number; pathao: number }[];
  totalCash: number; monthlyNet: number; runwayMonths: number | null;
  unassignedMethods: { method: string; count: number }[];
  pathaoPayoutAccount: string | null;
  vendorDues: { name: string; due: number }[]; totalVendorDue: number;
};

const linkBtn: React.CSSProperties = { border: 'none', background: 'none', color: '#2563eb', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, padding: 0 };

export const CashPositionCard = ({ onOpenTab }: { onOpenTab?: (t: string) => void }) => {
  const [pos, setPos] = useState<Position | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/finance/position').then(async r => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error); setPos(j); }).catch(e => setErr(e.message));
  }, []);

  const action = onOpenTab && <button type="button" onClick={() => onOpenTab('settings')} style={linkBtn}><SettingsIcon size={12} /> Accounts</button>;

  if (err) return <Card title="Cash & runway" action={action}><p style={{ margin: 0, fontSize: '0.8rem', color: '#b91c1c' }}>{err}</p></Card>;
  if (!pos) return <Card title="Cash & runway"><div className="fin-loading-bar" /></Card>;

  if (pos.accounts.length === 0) {
    return (
      <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Wallet size={15} /> Cash & runway</span>} action={action}>
        <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
          Add your bank, bKash and cash accounts with today’s balance to see live balances and how many months of cash you have.
        </p>
        {onOpenTab && <button type="button" onClick={() => onOpenTab('settings')} style={linkBtn}>Set up accounts <ArrowRight size={12} /></button>}
      </Card>
    );
  }

  const burning = pos.monthlyNet < 0;
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Wallet size={15} /> Cash & runway</span>} subtitle="Balances today, from opening balances + recorded movements" action={action}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 900, color: pos.totalCash >= 0 ? '#0f172a' : '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>{fmt(pos.totalCash)}</span>
        <span style={{ fontSize: '0.78rem', color: burning ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
          {burning
            ? pos.runwayMonths != null ? `≈ ${pos.runwayMonths.toFixed(1)} months of runway` : 'Burning cash'
            : `Cash-positive: +${fmtCompact(pos.monthlyNet)}/month`}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pos.accounts.map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: '#334155' }}>{a.name}{a.id === pos.pathaoPayoutAccount && <span style={{ color: '#94a3b8' }}> · receives Pathao</span>}</span>
            <b style={{ color: a.balance >= 0 ? '#0f172a' : '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>{fmt(a.balance)}</b>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 10, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.76rem', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Avg monthly cash flow (90 days)</span><b style={{ color: burning ? '#b91c1c' : '#15803d' }}>{fmt(pos.monthlyNet)}</b></div>
        {pos.totalVendorDue > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }} title={pos.vendorDues.map(v => `${v.name}: ${fmt(v.due)}`).join('\n')}>
            <span>Owed to vendors ({pos.vendorDues.length})</span><b style={{ color: '#b45309' }}>{fmt(pos.totalVendorDue)}</b>
          </div>
        )}
        {pos.unassignedMethods.length > 0 && (
          <div style={{ display: 'flex', gap: 5, color: '#b45309' }}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{pos.unassignedMethods.map(m => m.method).join(', ')} {pos.unassignedMethods.length > 1 ? 'aren’t' : 'isn’t'} linked to an account, so {pos.unassignedMethods.length > 1 ? 'those payments are' : 'those payments are'} missing from balances.</span>
          </div>
        )}
        {!pos.pathaoPayoutAccount && <div style={{ display: 'flex', gap: 5, color: '#b45309' }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span>Choose which account receives Pathao payouts.</span></div>}
      </div>
    </Card>
  );
};

export const BudgetCard = ({ data, range, isCurrent, onOpenTab }: {
  data: FinanceSummary; range: PeriodRange; isCurrent: boolean; onOpenTab?: (t: string) => void;
}) => {
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  useEffect(() => {
    fetch('/api/finance/config/budgets').then(r => r.json()).then(j => setBudgets(j.items || [])).catch(() => setBudgets([]));
  }, []);

  const action = onOpenTab && <button type="button" onClick={() => onOpenTab('settings')} style={linkBtn}><SettingsIcon size={12} /> Budgets</button>;
  if (!budgets) return <Card title="Budget vs actual"><div className="fin-loading-bar" /></Card>;

  // Projection only makes sense for a period still in progress
  const { days, elapsedDays } = data.range;
  const pace = isCurrent && elapsedDays >= 3 && elapsedDays < days ? days / elapsedDays : 1;

  const rows = [
    { scope: 'revenue', label: 'Revenue', actual: data.pl.revenue.total, color: CHART.revenue, goodWhenOver: true },
    ...COST_GROUPS.map(g => ({ scope: g.key, label: g.label, actual: data.pl.groups[g.key], color: CHART.groups[g.key], goodWhenOver: false })),
  ].map(r => ({ ...r, budget: budgetForRange(budgets, range, r.scope), projected: r.actual * pace }))
    .filter(r => r.budget != null);

  if (rows.length === 0) {
    return (
      <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Target size={15} /> Budget vs actual</span>} action={action}>
        <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>Set a monthly revenue target and spending budgets to track progress and get warned before you overspend.</p>
        {onOpenTab && <button type="button" onClick={() => onOpenTab('settings')} style={linkBtn}>Set budgets <ArrowRight size={12} /></button>}
      </Card>
    );
  }

  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Target size={15} /> Budget vs actual</span>}
      subtitle={pace > 1 ? `Faint bar = where you’ll land at the current pace (${elapsedDays}/${days} days)` : 'Budgets prorated to this period'} action={action}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {rows.map(r => {
          const budget = r.budget!;
          const pct = budget ? (r.actual / budget) * 100 : 0;
          const projPct = budget ? (r.projected / budget) * 100 : 0;
          const scale = Math.max(100, projPct, pct);
          const status = r.goodWhenOver
            ? pct >= 100 ? { text: 'Target hit', color: '#15803d' } : projPct >= 100 ? { text: 'On track', color: '#15803d' } : { text: pace > 1 ? `Heading for ${projPct.toFixed(0)}%` : `${pct.toFixed(0)}% of target`, color: '#b45309' }
            : pct > 100 ? { text: `Over by ${fmtCompact(r.actual - budget)}`, color: '#b91c1c' } : projPct > 100 ? { text: 'Will overshoot', color: '#b45309' } : { text: 'Within budget', color: '#15803d' };
          return (
            <div key={r.scope}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.79rem', marginBottom: 4 }}>
                <span style={{ color: '#334155' }}>{r.label} <span style={{ color: status.color, fontWeight: 700, fontSize: '0.72rem' }}>· {status.text}</span></span>
                <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}><b style={{ color: '#0f172a' }}>{fmtCompact(r.actual)}</b><span style={{ color: '#94a3b8' }}> / {fmtCompact(budget)}</span></span>
              </div>
              <div style={{ position: 'relative', height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                {pace > 1 && <div style={{ position: 'absolute', inset: 0, width: `${(Math.min(projPct, scale) / scale) * 100}%`, background: r.color, opacity: 0.22, borderRadius: 99 }} />}
                <div style={{ position: 'absolute', inset: 0, width: `${(Math.min(pct, scale) / scale) * 100}%`, background: r.color, borderRadius: 99 }} />
                <div title="Budget" style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${(100 / scale) * 100}% - 2px)`, width: 2, background: '#0f172a' }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
