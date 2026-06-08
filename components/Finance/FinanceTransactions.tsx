'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, Search, AlertCircle, Truck, Smartphone, Banknote } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { FinTransaction } from '@/lib/types/finance';
import { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, TRANSFER_CATEGORIES } from '@/lib/types/finance';
import { fmt, getCategoryLabel, getCategoryColor, PAYMENT_METHODS, TYPE_CATEGORIES, inputStyle, selectStyle, btnPrimary, btnSecondary } from './shared';

const TYPE_COLORS: Record<string, string> = {
  income: '#16a34a',
  expense: '#dc2626',
  transfer: '#2563eb',
};

const TYPE_BG: Record<string, string> = {
  income: 'rgba(22,163,74,0.1)',
  expense: 'rgba(220,38,38,0.1)',
  transfer: 'rgba(37,99,235,0.1)',
};

type QuickForm = {
  date: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  description: string;
  amount: string;
  payment_method: string;
  vendor_name: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): QuickForm => ({
  date: today(),
  type: 'expense',
  category: 'miscellaneous',
  description: '',
  amount: '',
  payment_method: 'Cash',
  vendor_name: '',
});

type RevenueEntry = { date: string; amount: string; description: string };
const emptyRevEntry = (): RevenueEntry => ({ date: today(), amount: '', description: '' });

const EXPENSE_GROUPS = [
  { key: 'production', label: 'Production', color: '#7c3aed', cats: ['fabric', 'accessories', 'sewing', 'packaging_material'] },
  { key: 'ads',        label: 'Ads',        color: '#f97316', cats: ['ads_meta', 'ads_google'] },
  { key: 'fixed',      label: 'Fixed',      color: '#2563eb', cats: ['rent', 'salary'] },
  { key: 'other',      label: 'Other',      color: '#94a3b8', cats: ['transport', 'photoshoot', 'miscellaneous'] },
];

export const FinanceTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<FinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<QuickForm>(emptyForm());
  const [filters, setFilters] = useState({ type: '', category: '', search: '', dateFrom: '', dateTo: '' });
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [revFeedback, setRevFeedback] = useState<string | null>(null);
  const [pathaoEntry, setPathaoEntry] = useState<RevenueEntry>(emptyRevEntry());
  const [bkashEntry, setBkashEntry] = useState<RevenueEntry>(emptyRevEntry());
  const [cashEntry, setCashEntry] = useState<RevenueEntry>(emptyRevEntry());
  const [revSaving, setRevSaving] = useState<string | null>(null);
  const [finCharts, setFinCharts] = useState<any[]>([]);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/finance/charts').then(r => r.json()).then(json => {
      if (!json.error && json.months) {
        setFinCharts(json.months.map((m: any) => ({
          label: m.label,
          production: EXPENSE_GROUPS[0].cats.reduce((s, c) => s + (m[c] || 0), 0),
          ads:        EXPENSE_GROUPS[1].cats.reduce((s, c) => s + (m[c] || 0), 0),
          fixed:      EXPENSE_GROUPS[2].cats.reduce((s, c) => s + (m[c] || 0), 0),
          other:      EXPENSE_GROUPS[3].cats.reduce((s, c) => s + (m[c] || 0), 0),
        })));
      }
    }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: '200' });
    if (filters.type) params.set('type', filters.type);
    if (filters.category) params.set('category', filters.category);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    try {
      const res = await fetch(`/api/finance/transactions?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setTransactions(json.transactions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.type, filters.category, filters.dateFrom, filters.dateTo]);

  const handleTypeChange = (type: 'income' | 'expense' | 'transfer') => {
    const cats = TYPE_CATEGORIES[type];
    const firstCat = Object.keys(cats)[0];
    setForm(f => ({ ...f, type, category: firstCat }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          type: form.type,
          category: form.category,
          description: form.description.trim(),
          amount: Number(form.amount),
          payment_method: form.payment_method,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setFeedback({ msg: 'Transaction added', ok: true });
      setForm(emptyForm());
      load();
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) {
      setFeedback({ msg: e.message, ok: false });
    } finally {
      setSaving(false);
    }
  };

  const postRevenue = useCallback(async (
    category: string,
    method: string,
    entry: RevenueEntry,
    defaultDesc: string,
    resetFn: () => void,
  ) => {
    if (!entry.amount || Number(entry.amount) <= 0) return;
    setRevSaving(category);
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: entry.date,
          type: 'income',
          category,
          description: entry.description.trim() || defaultDesc,
          amount: Number(entry.amount),
          payment_method: method,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRevFeedback(`${getCategoryLabel(category)} logged — ${fmt(Number(entry.amount))}`);
      resetFn();
      load();
      setTimeout(() => setRevFeedback(null), 3500);
    } catch (e: any) {
      setRevFeedback(`Error: ${e.message}`);
    } finally {
      setRevSaving(null);
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    await fetch(`/api/finance/transactions?id=${id}`, { method: 'DELETE' });
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const filtered = filters.search
    ? transactions.filter(t =>
        t.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        getCategoryLabel(t.category).toLowerCase().includes(filters.search.toLowerCase()) ||
        (t.vendor_name || '').toLowerCase().includes(filters.search.toLowerCase())
      )
    : transactions;

  const totals = filtered.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else if (t.type === 'expense') acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const RevTile = ({
    icon: Icon, title, color, bg, entry, setEntry, category, method, defaultDesc,
  }: {
    icon: React.FC<any>; title: string; color: string; bg: string;
    entry: RevenueEntry; setEntry: React.Dispatch<React.SetStateAction<RevenueEntry>>;
    category: string; method: string; defaultDesc: string;
  }) => (
    <div style={{ background: '#fff', border: `1px solid ${bg}`, borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'grid', placeItems: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{title}</div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{method}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <input type="date" value={entry.date} onChange={e => setEntry(f => ({ ...f, date: e.target.value }))} style={{ ...inputStyle, fontSize: '0.78rem' }} />
        <input type="text" value={entry.description} onChange={e => setEntry(f => ({ ...f, description: e.target.value }))} placeholder={defaultDesc} style={{ ...inputStyle, fontSize: '0.78rem' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" value={entry.amount} onChange={e => setEntry(f => ({ ...f, amount: e.target.value }))} placeholder="Amount ৳" min="1" style={{ ...inputStyle, fontSize: '0.88rem', fontWeight: 700 }} />
          <button
            onClick={() => postRevenue(category, method, entry, defaultDesc, () => setEntry(emptyRevEntry()))}
            disabled={!entry.amount || revSaving === category}
            style={{ ...btnPrimary, background: color, borderColor: color, padding: '8px 14px', flexShrink: 0, opacity: !entry.amount ? 0.5 : 1 }}
          >
            {revSaving === category ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
          </button>
        </div>
      </div>
    </div>
  );

  const hasExpenses = finCharts.some(m => m.production + m.ads + m.fixed + m.other > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Expense Category Trend */}
      <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 800 }}>Expense Trend — Last 6 Months</h3>
        {hasExpenses ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={finCharts} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `৳${Number(v).toLocaleString()}`} contentStyle={{ fontSize: '0.78rem', borderRadius: 8, border: '1px solid #e2e7ee' }} />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              {EXPENSE_GROUPS.map(g => (
                <Bar key={g.key} dataKey={g.key} name={g.label} stackId="a" fill={g.color} radius={g.key === 'other' ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 6 }}>
            <span style={{ fontSize: '1.4rem' }}>📊</span>
            <span style={{ fontSize: '0.83rem' }}>No expenses logged yet</span>
            <span style={{ fontSize: '0.74rem' }}>Add expense transactions below to see the breakdown</span>
          </div>
        )}
      </div>

      {/* Revenue Quick Entry */}
      <div style={{ background: '#f8faff', border: '1px solid #dbeafe', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#1e40af' }}>Log Revenue</h3>
          {revFeedback && (
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#16a34a', padding: '3px 10px', background: 'rgba(22,163,74,0.08)', borderRadius: 6 }}>
              {revFeedback}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
          <RevTile icon={Truck} title="Pathao COD Payout" color="#0891b2" bg="rgba(8,145,178,0.1)" entry={pathaoEntry} setEntry={setPathaoEntry} category="pathao_payout" method="Bank Transfer" defaultDesc="Pathao COD payout" />
          <RevTile icon={Smartphone} title="bKash Receipt" color="#16a34a" bg="rgba(22,163,74,0.1)" entry={bkashEntry} setEntry={setBkashEntry} category="sales_prepaid" method="bKash" defaultDesc="Prepaid sale via bKash" />
          <RevTile icon={Banknote} title="Cash Receipt" color="#d97706" bg="rgba(217,119,6,0.1)" entry={cashEntry} setEntry={setCashEntry} category="sales_prepaid" method="Cash" defaultDesc="Prepaid sale cash received" />
        </div>
      </div>

      {/* Quick add form */}
      <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 800 }}>Quick Add Transaction</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 140px 1fr 1fr 140px 140px auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Type</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['income', 'expense', 'transfer'] as const).map(t => (
                  <button key={t} type="button" onClick={() => handleTypeChange(t)}
                    style={{ flex: 1, padding: '7px 2px', border: '1px solid', borderColor: form.type === t ? TYPE_COLORS[t] : '#e2e7ee', borderRadius: 6, background: form.type === t ? TYPE_BG[t] : '#fff', color: form.type === t ? TYPE_COLORS[t] : '#64748b', fontSize: '0.62rem', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase' }}>
                    {t === 'income' ? 'In' : t === 'expense' ? 'Out' : 'Txfr'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={selectStyle} required>
                {Object.entries(TYPE_CATEGORIES[form.type]).map(([k, v]) => (
                  <option key={k} value={k}>{v as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this for?" style={inputStyle} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Amount (৳)</label>
              <input ref={amountRef} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" min="1" step="0.01" style={inputStyle} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={selectStyle}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, height: 36, marginTop: 24 }}>
              {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              Add
            </button>
          </div>
          {feedback && (
            <div style={{ marginTop: 10, padding: '7px 12px', borderRadius: 7, background: feedback.ok ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)', color: feedback.ok ? '#16a34a' : '#dc2626', fontSize: '0.78rem', fontWeight: 600 }}>
              {feedback.msg}
            </div>
          )}
        </form>
      </div>

      {/* Filters + totals */}
      <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 200px', border: '1px solid #e2e7ee', borderRadius: 7, padding: '0 10px', background: '#f9fafb' }}>
            <Search size={14} color="#94a3b8" />
            <input type="text" placeholder="Search transactions..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.83rem', width: '100%', padding: '8px 0' }} />
          </div>
          <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} style={{ ...selectStyle, width: 120 }}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))} style={{ ...selectStyle, width: 160 }}>
            <option value="">All categories</option>
            <optgroup label="Income">{Object.entries(INCOME_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>
            <optgroup label="Expense">{Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>
            <optgroup label="Transfer">{Object.entries(TRANSFER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>
          </select>
          <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} style={{ ...inputStyle, width: 140 }} />
          <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} style={{ ...inputStyle, width: 140 }} />
          <button onClick={load} style={{ ...btnSecondary, padding: '7px 12px' }}>
            <RefreshCw size={13} />
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: '0.83rem' }}>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>+{fmt(totals.income)}</span>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>-{fmt(totals.expense)}</span>
            <span style={{ color: totals.income - totals.expense >= 0 ? '#16a34a' : '#dc2626', fontWeight: 800 }}>
              Net {fmt(totals.income - totals.expense)}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction table */}
      <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: 10, color: '#64748b' }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.85rem' }}>Loading transactions...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
            <AlertCircle size={20} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No transactions found. Use the form above to add your first entry.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Date', 'Type', 'Category', 'Description', 'Method', 'Vendor', 'Amount', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', background: TYPE_BG[tx.type], color: TYPE_COLORS[tx.type] }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: getCategoryColor(tx.category), flexShrink: 0, display: 'inline-block' }} />
                        {getCategoryLabel(tx.category)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#0f172a' }}>{tx.description}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>{tx.payment_method}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#64748b' }}>{tx.vendor_name || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, fontSize: '0.88rem', whiteSpace: 'nowrap', color: tx.type === 'income' ? '#16a34a' : '#0f172a' }}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}{fmt(tx.amount)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => handleDelete(tx.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, borderRadius: 5, display: 'flex' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', background: '#f9fafb', fontSize: '0.75rem', color: '#94a3b8' }}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};
