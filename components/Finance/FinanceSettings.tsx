'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Check, X, Pencil, Wallet, Target, Repeat, Calculator } from 'lucide-react';
import { COST_GROUPS } from '@/lib/finance/types';
import { fmt, PAYMENT_METHODS, TYPE_CATEGORIES, inputStyle, selectStyle, btnPrimary, btnSecondary, getCategoryLabel } from './shared';
import { Card, Spinner, Segmented, useToasts, ToastStack, LoadingState } from './ui';
import { invalidateFinanceCache } from './period';
import { todayISO } from '@/lib/finance/periods';

type Account = { id: string; name: string; kind: string; payment_methods: string[]; opening_balance: number; opening_date: string; sort_order: number };
type Budget = { id: string; month: string | null; scope: string; amount: number };
type Recurring = { id: string; description: string; type: 'income' | 'expense' | 'transfer'; category: string; amount: number; payment_method: string; day_of_month: number; start_month: string; end_month: string | null; is_active: boolean; last_posted_month: string | null };

const api = async (section: string, init?: RequestInit) => {
  const res = await fetch(`/api/finance/config/${section}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
};
const post = (section: string, body: unknown) => api(section, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const del = (section: string, id: string) => fetch(`/api/finance/config/${section}?id=${id}`, { method: 'DELETE' }).then(r => r.json());

const SCOPE_LABEL: Record<string, string> = { revenue: 'Revenue target', ...Object.fromEntries(COST_GROUPS.map(g => [g.key, `${g.label} budget`])) };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '0.66rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', color: '#334155', verticalAlign: 'middle' };
const small: React.CSSProperties = { ...inputStyle, padding: '6px 8px', fontSize: '0.8rem' };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, borderRadius: 6, display: 'inline-flex' };

export const FinanceSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{ cogs_method: string; default_unit_cost: number | null; pathao_payout_account: string | null } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [unitCostDraft, setUnitCostDraft] = useState('');
  const [batchAvg, setBatchAvg] = useState<number | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const load = useCallback(async () => {
    try {
      const [s, a, b, r] = await Promise.all([api('settings'), api('accounts'), api('budgets'), api('recurring')]);
      setSettings(s.settings);
      setUnitCostDraft(s.settings.default_unit_cost == null ? '' : String(s.settings.default_unit_cost));
      setAccounts(a.items); setBudgets(b.items); setRecurring(r.items);
    } catch (e: any) {
      push({ text: e.message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // The products report carries the batch-average fallback cost
    const t = todayISO();
    fetch(`/api/finance/products?from=${t.slice(0, 7)}-01&to=${t}`).then(r => r.json()).then(j => setBatchAvg(j.fallbackUnitCost ?? null)).catch(() => {});
  }, []);

  const saveSetting = async (key: string, value: unknown, msg: string) => {
    try { await post('settings', { key, value }); invalidateFinanceCache(); push({ text: msg }); load(); }
    catch (e: any) { push({ text: e.message, tone: 'error' }); }
  };

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); invalidateFinanceCache(); push({ text: msg }); load(); return true; }
    catch (e: any) { push({ text: e.message, tone: 'error' }); return false; }
  };

  if (loading || !settings) return <LoadingState label="Loading settings…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Costing */}
      <Card title={<span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}><Calculator size={15} /> Production cost method</span>}
        subtitle="How fabric, sewing, accessories and packaging reach the P&L">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {[
            { id: 'per_unit', title: 'Per unit sold (recommended)', body: 'Cost follows sales: each invoiced delivery costs units × that product’s unit cost. Purchases become stock, so a big fabric order no longer wrecks one month’s margin.' },
            { id: 'cash', title: 'When paid', body: 'Purchases hit the P&L the day you pay for them. Simple, but margins swing with buying cycles.' },
          ].map(o => (
            <button key={o.id} type="button" onClick={() => settings.cogs_method !== o.id && saveSetting('cogs_method', o.id, 'Cost method updated')}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${settings.cogs_method === o.id ? '#0f172a' : '#e2e7ee'}`, background: settings.cogs_method === o.id ? '#f8fafc' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
                {settings.cogs_method === o.id && <Check size={14} />} {o.title}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 5, lineHeight: 1.45 }}>{o.body}</div>
            </button>
          ))}
        </div>
        {settings.cogs_method === 'per_unit' && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
              Default unit cost (৳) — used for products without their own cost
              <input type="number" min="0" step="1" value={unitCostDraft} onChange={e => setUnitCostDraft(e.target.value)}
                placeholder={batchAvg ? `Batch average ৳${Math.round(batchAvg)}` : 'e.g. 420'} style={{ ...small, width: 220, display: 'block', marginTop: 5 }} />
            </label>
            <button type="button" style={{ ...btnPrimary, padding: '7px 12px' }}
              onClick={() => saveSetting('default_unit_cost', unitCostDraft === '' ? null : Number(unitCostDraft), unitCostDraft === '' ? 'Using batch average' : 'Default unit cost saved')}>
              Save
            </button>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Leave empty to use the production-batch average{batchAvg ? ` (৳${Math.round(batchAvg)})` : ''}. Set exact costs per product in the Products tab.
            </span>
          </div>
        )}
      </Card>

      <AccountsCard accounts={accounts} payoutAccount={settings.pathao_payout_account} run={run} saveSetting={saveSetting} />
      <BudgetsCard budgets={budgets} run={run} />
      <RecurringCard items={recurring} run={run} />
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
};

// ─── accounts ─────────────────────────────────────────────────────────────────

type Run = (fn: () => Promise<unknown>, msg: string) => Promise<boolean>;

const emptyAccount = (): Partial<Account> => ({ name: '', kind: 'bank', payment_methods: [], opening_balance: 0, opening_date: todayISO() });

const AccountsCard = ({ accounts, payoutAccount, run, saveSetting }: {
  accounts: Account[]; payoutAccount: string | null; run: Run; saveSetting: (k: string, v: unknown, m: string) => Promise<void>;
}) => {
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const used = new Map<string, string>();
  for (const a of accounts) for (const m of a.payment_methods || []) used.set(m, a.name);

  const save = async () => {
    if (!edit?.name?.trim()) return;
    const ok = await run(() => post('accounts', edit), edit.id ? 'Account updated' : 'Account added');
    if (ok) setEdit(null);
  };

  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}><Wallet size={15} /> Accounts & opening balances</span>}
      subtitle="Balances = opening balance + every recorded transaction paid via the linked methods since the opening date"
      action={!edit && <button type="button" onClick={() => setEdit(emptyAccount())} style={{ ...btnSecondary, padding: '6px 10px' }}><Plus size={13} /> Add account</button>}>
      {accounts.length === 0 && !edit && (
        <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: '#64748b' }}>
          No accounts yet. Add your bank, bKash, Nagad and cash box with today’s balance to see live balances and runway on the Overview.
        </p>
      )}
      {(accounts.length > 0 || edit) && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr>{['Account', 'Type', 'Payment methods', 'Opening balance', 'As of', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {accounts.map(a => edit?.id === a.id ? null : (
                <tr key={a.id}>
                  <td style={{ ...td, fontWeight: 700, color: '#0f172a' }}>{a.name}{payoutAccount === a.id && <span style={{ marginLeft: 6, fontSize: '0.66rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: 5, padding: '1px 6px', fontWeight: 800 }}>PATHAO PAYOUTS</span>}</td>
                  <td style={td}>{a.kind}</td>
                  <td style={td}>{(a.payment_methods || []).join(', ') || <span style={{ color: '#b45309' }}>none linked</span>}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(a.opening_balance))}</td>
                  <td style={td}>{a.opening_date}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {payoutAccount !== a.id && (
                      <button type="button" style={{ ...iconBtn, fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }} onClick={() => saveSetting('pathao_payout_account', a.id, `Pathao payouts now land in ${a.name}`)}>Receives Pathao</button>
                    )}
                    <button type="button" aria-label={`Edit ${a.name}`} style={iconBtn} onClick={() => setEdit(a)}><Pencil size={14} /></button>
                    <button type="button" aria-label={`Delete ${a.name}`} style={{ ...iconBtn, color: '#dc2626' }} onClick={() => run(() => del('accounts', a.id), 'Account removed')}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {edit && (
                <tr style={{ background: '#f8fafc' }}>
                  <td style={td}><input autoFocus value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. City Bank" style={small} /></td>
                  <td style={td}>
                    <select value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value })} style={{ ...selectStyle, padding: '6px 8px', fontSize: '0.8rem' }}>
                      {['bank', 'mobile', 'cash', 'card'].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {PAYMENT_METHODS.map(m => {
                        const on = edit.payment_methods?.includes(m);
                        const takenBy = used.get(m);
                        const taken = !!takenBy && !on && takenBy !== edit.name;
                        return (
                          <button key={m} type="button" disabled={taken} title={taken ? `Linked to ${takenBy}` : undefined}
                            onClick={() => setEdit({ ...edit, payment_methods: on ? edit.payment_methods!.filter(x => x !== m) : [...(edit.payment_methods || []), m] })}
                            style={{ padding: '3px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, border: '1px solid', cursor: taken ? 'not-allowed' : 'pointer', opacity: taken ? 0.4 : 1, borderColor: on ? '#0f172a' : '#e2e7ee', background: on ? '#0f172a' : '#fff', color: on ? '#fff' : '#334155' }}>
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td style={td}><input type="number" step="0.01" value={edit.opening_balance ?? 0} onChange={e => setEdit({ ...edit, opening_balance: Number(e.target.value) })} style={{ ...small, width: 120 }} /></td>
                  <td style={td}><input type="date" value={edit.opening_date} onChange={e => setEdit({ ...edit, opening_date: e.target.value })} style={{ ...small, width: 140 }} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button type="button" aria-label="Save account" style={{ ...iconBtn, color: '#15803d' }} onClick={save}><Check size={16} /></button>
                    <button type="button" aria-label="Cancel" style={iconBtn} onClick={() => setEdit(null)}><X size={16} /></button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {accounts.length > 0 && !payoutAccount && (
        <p style={{ margin: '10px 0 0', fontSize: '0.76rem', color: '#b45309' }}>Pick which account receives Pathao payouts (“Receives Pathao”) so they show up in its balance.</p>
      )}
    </Card>
  );
};

// ─── budgets ──────────────────────────────────────────────────────────────────

const BudgetsCard = ({ budgets, run }: { budgets: Budget[]; run: Run }) => {
  const [month, setMonth] = useState<string>(''); // '' = every month
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const scopes = ['revenue', ...COST_GROUPS.map(g => g.key)];
  const forMonth = (m: string) => budgets.filter(b => (b.month || '') === m);
  const months = [...new Set(budgets.map(b => b.month).filter(Boolean) as string[])].sort();

  useEffect(() => {
    setDrafts(Object.fromEntries(scopes.map(s => [s, String(forMonth(month).find(b => b.scope === s)?.amount ?? '')])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, budgets]);

  const saveAll = async () => {
    const ops: Promise<unknown>[] = [];
    for (const s of scopes) {
      const existing = forMonth(month).find(b => b.scope === s);
      const v = drafts[s];
      if (v === '' && existing) ops.push(del('budgets', existing.id));
      else if (v !== '' && (!existing || Number(v) !== Number(existing.amount))) {
        ops.push(post('budgets', { id: existing?.id, month: month || null, scope: s, amount: Number(v) }));
      }
    }
    await run(() => Promise.all(ops), month ? `Budgets for ${month} saved` : 'Default monthly budgets saved');
  };

  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}><Target size={15} /> Budgets & targets</span>}
      subtitle="Monthly amounts. Set defaults for every month, then override any month that’s different."
      action={
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented size="sm" value={month ? 'month' : 'default'} onChange={v => setMonth(v === 'default' ? '' : (month || todayISO().slice(0, 7)))}
            options={[{ id: 'default', label: 'Every month' }, { id: 'month', label: 'Specific month' }]} />
          {month && <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ ...small, width: 150 }} />}
        </div>
      }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {scopes.map(s => {
          const fallback = month ? forMonth('').find(b => b.scope === s)?.amount : undefined;
          return (
            <label key={s} style={{ fontSize: '0.72rem', fontWeight: 700, color: s === 'revenue' ? '#1d4ed8' : '#64748b' }}>
              {SCOPE_LABEL[s]}
              <input type="number" min="0" step="100" value={drafts[s] ?? ''} onChange={e => setDrafts(d => ({ ...d, [s]: e.target.value }))}
                placeholder={fallback != null ? `Default ${fmt(Number(fallback))}` : 'Not set'} style={{ ...small, display: 'block', marginTop: 5 }} />
            </label>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={saveAll} style={{ ...btnPrimary, padding: '7px 12px' }}><Check size={13} /> Save {month ? month : 'defaults'}</button>
        {months.length > 0 && <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Overrides: {months.map(m => (
          <button key={m} type="button" onClick={() => setMonth(m)} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem', padding: '0 3px' }}>{m}</button>
        ))}</span>}
      </div>
    </Card>
  );
};

// ─── recurring ────────────────────────────────────────────────────────────────

const emptyRecurring = (): Partial<Recurring> => ({
  description: '', type: 'expense', category: 'miscellaneous', amount: 0, payment_method: 'Cash', day_of_month: 1,
  start_month: todayISO().slice(0, 7), end_month: null, is_active: true,
});

const RecurringCard = ({ items, run }: { items: Recurring[]; run: Run }) => {
  const [edit, setEdit] = useState<Partial<Recurring> | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!edit?.description?.trim() || !(Number(edit.amount) > 0)) return;
    setSaving(true);
    const ok = await run(() => post('recurring', edit), edit.id ? 'Recurring entry updated' : 'Recurring entry added — it posts automatically each month');
    setSaving(false);
    if (ok) setEdit(null);
  };

  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}><Repeat size={15} /> Recurring transactions</span>}
      subtitle="Posted to Transactions automatically on the chosen day (daily job). Rent and salary belong in Fixed Costs instead."
      action={!edit && <button type="button" onClick={() => setEdit(emptyRecurring())} style={{ ...btnSecondary, padding: '6px 10px' }}><Plus size={13} /> Add</button>}>
      {items.length === 0 && !edit && <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Nothing recurring yet — e.g. internet bill, software subscriptions, a loan instalment.</p>}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr>{['Description', 'Category', 'Amount', 'Schedule', 'Last posted', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
                  <td style={{ ...td, fontWeight: 700, color: '#0f172a' }}>{r.description}</td>
                  <td style={td}>{getCategoryLabel(r.category)}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.type === 'income' ? '+' : '−'}{fmt(Number(r.amount))} · {r.payment_method}</td>
                  <td style={td}>Day {r.day_of_month}, from {r.start_month}{r.end_month ? ` to ${r.end_month}` : ''}</td>
                  <td style={td}>{r.last_posted_month || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button type="button" style={{ ...iconBtn, fontSize: '0.7rem', fontWeight: 700 }} onClick={() => run(() => post('recurring', { id: r.id, is_active: !r.is_active }), r.is_active ? 'Paused' : 'Resumed')}>{r.is_active ? 'Pause' : 'Resume'}</button>
                    <button type="button" aria-label={`Edit ${r.description}`} style={iconBtn} onClick={() => setEdit(r)}><Pencil size={14} /></button>
                    <button type="button" aria-label={`Delete ${r.description}`} style={{ ...iconBtn, color: '#dc2626' }} onClick={() => run(() => del('recurring', r.id), 'Recurring entry deleted')}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 10 }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', gridColumn: 'span 2' }}>Description
            <input autoFocus value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} style={{ ...small, display: 'block', marginTop: 4 }} /></label>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Type
            <select value={edit.type} onChange={e => { const type = e.target.value as Recurring['type']; setEdit({ ...edit, type, category: Object.keys(TYPE_CATEGORIES[type])[0] }); }} style={{ ...selectStyle, padding: '6px 8px', fontSize: '0.8rem', display: 'block', marginTop: 4 }}>
              <option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option>
            </select></label>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Category
            <select value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })} style={{ ...selectStyle, padding: '6px 8px', fontSize: '0.8rem', display: 'block', marginTop: 4 }}>
              {Object.entries(TYPE_CATEGORIES[edit.type || 'expense']).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
            </select></label>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Amount (৳)
            <input type="number" min="1" value={edit.amount || ''} onChange={e => setEdit({ ...edit, amount: Number(e.target.value) })} style={{ ...small, display: 'block', marginTop: 4 }} /></label>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Paid via
            <select value={edit.payment_method} onChange={e => setEdit({ ...edit, payment_method: e.target.value })} style={{ ...selectStyle, padding: '6px 8px', fontSize: '0.8rem', display: 'block', marginTop: 4 }}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select></label>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Day of month (1–28)
            <input type="number" min="1" max="28" value={edit.day_of_month || 1} onChange={e => setEdit({ ...edit, day_of_month: Number(e.target.value) })} style={{ ...small, display: 'block', marginTop: 4 }} /></label>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Starts
            <input type="month" value={edit.start_month || ''} onChange={e => setEdit({ ...edit, start_month: e.target.value })} style={{ ...small, display: 'block', marginTop: 4 }} /></label>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Ends (optional)
            <input type="month" value={edit.end_month || ''} onChange={e => setEdit({ ...edit, end_month: e.target.value || null })} style={{ ...small, display: 'block', marginTop: 4 }} /></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button type="button" disabled={saving} onClick={save} style={{ ...btnPrimary, padding: '7px 12px' }}>{saving ? <Spinner size={13} /> : <Check size={13} />} Save</button>
            <button type="button" onClick={() => setEdit(null)} style={{ ...btnSecondary, padding: '7px 12px' }}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
};
