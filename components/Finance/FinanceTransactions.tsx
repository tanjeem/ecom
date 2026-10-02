'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Search, Truck, Smartphone, Banknote, Megaphone, Scissors, Pencil, Copy, X, Download,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Receipt, Check, Paperclip, Repeat,
} from 'lucide-react';
import type { FinTransaction, FinVendor } from '@/lib/types/finance';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TRANSFER_CATEGORIES } from '@/lib/types/finance';
import { todayISO } from '@/lib/finance/periods';
import { fmt, getCategoryLabel, getCategoryColor, PAYMENT_METHODS, TYPE_CATEGORIES, inputStyle, selectStyle, btnPrimary, btnSecondary } from './shared';
import { Spinner, LoadingState, ErrorState, EmptyState, Segmented, useToasts, ToastStack, FormField } from './ui';
import { usePeriod, invalidateFinanceCache } from './period';

type TxType = 'income' | 'expense' | 'transfer';
type SortKey = 'date' | 'amount' | 'category' | 'description' | 'payment_method';

const TYPE_COLORS: Record<TxType, string> = { income: '#15803d', expense: '#b91c1c', transfer: '#1d4ed8' };
const TYPE_BG: Record<TxType, string> = { income: '#dcfce7', expense: '#fee2e2', transfer: '#dbeafe' };
const TYPE_LABEL: Record<TxType, string> = { income: 'Income', expense: 'Expense', transfer: 'Transfer' };
const TRANSFER_IN = new Set(['owner_investment', 'loan_received']);

type FormState = {
  id?: string;
  date: string;
  type: TxType;
  category: string;
  description: string;
  amount: string;
  payment_method: string;
  vendor_id: string;
  reference_no: string;
  notes: string;
  receipt_path?: string | null;
};

const emptyForm = (over: Partial<FormState> = {}): FormState => ({
  date: todayISO(), type: 'expense', category: 'miscellaneous', description: '', amount: '',
  payment_method: 'Cash', vendor_id: '', reference_no: '', notes: '', ...over,
});

const TEMPLATES: { label: string; icon: React.FC<any>; form: Partial<FormState> }[] = [
  { label: 'Pathao payout', icon: Truck, form: { type: 'income', category: 'pathao_payout', payment_method: 'Bank Transfer', description: 'Pathao COD payout' } },
  { label: 'bKash sale', icon: Smartphone, form: { type: 'income', category: 'sales_prepaid', payment_method: 'bKash', description: 'Prepaid sale via bKash' } },
  { label: 'Cash sale', icon: Banknote, form: { type: 'income', category: 'sales_prepaid', payment_method: 'Cash', description: 'Prepaid sale cash received' } },
  { label: 'Meta ads top-up', icon: Megaphone, form: { type: 'expense', category: 'ads_meta', payment_method: 'Card', description: 'Meta ads payment' } },
  { label: 'Fabric purchase', icon: Scissors, form: { type: 'expense', category: 'fabric', payment_method: 'Cash', description: 'Fabric purchase' } },
];

const signed = (t: { type: string; category: string; amount: number }) =>
  t.type === 'income' || (t.type === 'transfer' && TRANSFER_IN.has(t.category)) ? t.amount : -t.amount;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

function downloadCSV(rows: FinTransaction[], filename: string) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Signed amount', 'Method', 'Vendor', 'Reference', 'Notes'];
  const lines = rows.map(t => [
    t.date, t.type, getCategoryLabel(t.category), t.description, t.amount, signed(t), t.payment_method,
    t.vendor_name || '', t.reference_no || '', t.notes || '',
  ].map(esc).join(','));
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── editor drawer ────────────────────────────────────────────────────────────

const Editor = ({
  initial, vendors, recentDescriptions, onClose, onSaved,
}: {
  initial: FormState;
  vendors: FinVendor[];
  recentDescriptions: string[];
  onClose: () => void;
  onSaved: (msg: string, keepOpen: boolean) => void;
}) => {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const isEdit = !!form.id;

  useEffect(() => { setForm(initial); setErr(null); setReceipt(null); }, [initial]);
  useEffect(() => { amountRef.current?.focus(); }, [initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const setType = (type: TxType) => {
    const cats = TYPE_CATEGORIES[type];
    setForm(f => ({ ...f, type, category: f.category in cats ? f.category : Object.keys(cats)[0] }));
  };

  const save = async (keepOpen: boolean) => {
    if (!form.description.trim()) { setErr('Add a short description.'); return; }
    if (!(Number(form.amount) > 0)) { setErr('Amount must be more than 0.'); amountRef.current?.focus(); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/finance/transactions', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), description: form.description.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Save failed');
      if (receipt) {
        const fd = new FormData();
        fd.set('transaction_id', json.transaction.id);
        fd.set('file', receipt);
        const up = await fetch('/api/finance/receipts', { method: 'POST', body: fd });
        const upJson = await up.json().catch(() => ({}));
        // The transaction is saved either way — say so rather than failing the whole save
        if (!up.ok) {
          // Switch to edit mode so retrying updates this entry instead of creating a duplicate
          setForm(f => ({ ...f, id: json.transaction.id }));
          throw new Error(`Saved, but the receipt didn't upload: ${upJson.error || up.status}`);
        }
        setReceipt(null);
      }
      onSaved(`${isEdit ? 'Updated' : 'Added'} ${getCategoryLabel(form.category)} · ${fmt(Number(form.amount))}`, keepOpen);
      if (keepOpen) {
        // Keep date/type/category/method for rapid entry of similar rows
        setForm(f => emptyForm({ date: f.date, type: f.type, category: f.category, payment_method: f.payment_method, vendor_id: f.vendor_id }));
        amountRef.current?.focus();
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit transaction' : 'New transaction'} onKeyDown={onKeyDown}
      style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.35)' }} />
      <form
        onSubmit={e => { e.preventDefault(); save(false); }}
        style={{ position: 'relative', width: 'min(440px, 100vw)', height: '100%', background: '#fff', boxShadow: '-12px 0 40px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontWeight: 900, fontSize: '1rem', color: '#0f172a' }}>{isEdit ? 'Edit transaction' : 'New transaction'}</div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {(['expense', 'income', 'transfer'] as TxType[]).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                style={{ padding: '9px 0', borderRadius: 8, border: '1.5px solid', borderColor: form.type === t ? TYPE_COLORS[t] : '#e2e7ee', background: form.type === t ? TYPE_BG[t] : '#fff', color: form.type === t ? TYPE_COLORS[t] : '#64748b', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <FormField label="Amount (৳)">
            <input ref={amountRef} type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount}
              onChange={e => set('amount', e.target.value)} placeholder="0"
              style={{ ...inputStyle, fontSize: '1.5rem', fontWeight: 800, padding: '10px 12px', fontVariantNumeric: 'tabular-nums' }} />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Date">
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} required />
            </FormField>
            <FormField label="Category">
              <select value={form.category} onChange={e => set('category', e.target.value)} style={selectStyle}>
                {Object.entries(TYPE_CATEGORIES[form.type]).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Description">
            <input type="text" list="fin-desc-suggestions" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="What was this for?" style={inputStyle} />
            <datalist id="fin-desc-suggestions">
              {recentDescriptions.map(d => <option key={d} value={d} />)}
            </datalist>
          </FormField>

          <FormField label="Paid via">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PAYMENT_METHODS.map(m => (
                <button key={m} type="button" onClick={() => set('payment_method', m)}
                  style={{ padding: '6px 11px', borderRadius: 99, border: '1px solid', borderColor: form.payment_method === m ? '#0f172a' : '#e2e7ee', background: form.payment_method === m ? '#0f172a' : '#fff', color: form.payment_method === m ? '#fff' : '#334155', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                  {m}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Vendor (optional)">
            <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} style={selectStyle}>
              <option value="">— None —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <FormField label="Reference / invoice no. (optional)">
              <input type="text" value={form.reference_no} onChange={e => set('reference_no', e.target.value)} placeholder="e.g. TrxID, invoice #" style={inputStyle} />
            </FormField>
            <FormField label="Receipt (optional)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ ...btnSecondary, padding: '7px 11px', cursor: 'pointer' }}>
                  <Paperclip size={13} /> {receipt ? 'Change file' : form.receipt_path ? 'Replace receipt' : 'Attach photo or PDF'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" hidden
                    onChange={e => { const f = e.target.files?.[0]; if (f && f.size > 4 * 1024 * 1024) { setErr('Receipt must be under 4 MB.'); return; } setReceipt(f || null); }} />
                </label>
                {receipt && <span style={{ fontSize: '0.76rem', color: '#334155' }}>{receipt.name}</span>}
                {!receipt && form.receipt_path && form.id && (
                  <a href={`/api/finance/receipts?id=${form.id}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.76rem', color: '#2563eb', fontWeight: 700 }}>View current receipt</a>
                )}
              </div>
            </FormField>
            <FormField label="Notes (optional)">
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </FormField>
          </div>

          {err && <div role="alert" style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600 }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
          <button type="submit" disabled={saving} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '10px 14px' }}>
            {saving ? <Spinner size={14} /> : <Check size={14} />} {isEdit ? 'Save changes' : 'Save'}
          </button>
          {!isEdit && (
            <button type="button" disabled={saving} onClick={() => save(true)} style={{ ...btnSecondary, padding: '10px 14px' }}>
              Save & add another
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.66rem', color: '#94a3b8', paddingBottom: 8, background: '#fafbfc' }}>⌘/Ctrl + Enter to save · Esc to close</div>
      </form>
    </div>
  );
};

// ─── main ─────────────────────────────────────────────────────────────────────

export const FinanceTransactions: React.FC = () => {
  const period = usePeriod();
  const { range } = period;
  const [rows, setRows] = useState<FinTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ income: 0, expense: 0, transfer_in: 0, transfer_out: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<FinVendor[]>([]);

  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const [type, setType] = useState<'' | TxType>('');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [allDates, setAllDates] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<FormState | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { toasts, push, dismiss } = useToasts();

  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (!allDates) { p.set('date_from', range.from); p.set('date_to', range.to); }
    if (type) p.set('type', type);
    if (category) p.set('category', category);
    if (method) p.set('method', method);
    if (q.trim()) p.set('q', q.trim());
    return p;
  }, [allDates, range.from, range.to, type, category, method, q]);

  // Any filter change returns to page 1 and clears the selection
  useEffect(() => { setPage(1); setSelected(new Set()); }, [filterParams, pageSize]);

  useEffect(() => {
    fetch('/api/finance/vendors').then(r => r.json()).then(j => setVendors(j.vendors || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const p = new URLSearchParams(filterParams);
    p.set('sort', sort.key); p.set('dir', sort.dir); p.set('page', String(page)); p.set('page_size', String(pageSize));
    setLoading(true);
    fetch(`/api/finance/transactions?${p}`, { signal: ctrl.signal })
      .then(async r => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || 'Failed to load'); return j; })
      .then(j => {
        setRows(j.transactions || []);
        setTotal(j.total || 0);
        if (j.totals) setTotals(j.totals);
        setError(null);
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [filterParams, sort, page, pageSize, reloadKey]);

  const reload = useCallback(() => { invalidateFinanceCache(); setReloadKey(k => k + 1); }, []);

  // "N" opens a new entry from anywhere on the tab
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !editor) { e.preventDefault(); openNew(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const defaultDate = () => {
    const t = todayISO();
    return t >= range.from && t <= range.to ? t : range.to < t ? range.to : range.from;
  };
  const openNew = (over: Partial<FormState> = {}) => setEditor(emptyForm({ date: defaultDate(), ...over }));
  const openEdit = (t: FinTransaction) => setEditor({
    id: t.id, date: t.date, type: t.type, category: t.category, description: t.description, amount: String(t.amount),
    payment_method: t.payment_method || 'Cash', vendor_id: t.vendor_id || '', reference_no: t.reference_no || '', notes: t.notes || '',
    receipt_path: t.receipt_path ?? null,
  });
  const duplicate = (t: FinTransaction) => setEditor({
    date: defaultDate(), type: t.type, category: t.category, description: t.description, amount: String(t.amount),
    payment_method: t.payment_method || 'Cash', vendor_id: t.vendor_id || '', reference_no: '', notes: t.notes || '',
  });

  const restore = async (items: FinTransaction[]) => {
    const results = await Promise.allSettled(items.map(t => fetch('/api/finance/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: t.date, type: t.type, category: t.category, description: t.description, amount: t.amount,
        payment_method: t.payment_method, vendor_id: t.vendor_id, reference_no: t.reference_no, notes: t.notes,
      }),
    }).then(r => { if (!r.ok) throw new Error(); })));
    const failed = results.filter(r => r.status === 'rejected').length;
    push(failed ? { text: `Restored ${items.length - failed}, ${failed} failed`, tone: 'error' } : { text: `Restored ${items.length} transaction${items.length > 1 ? 's' : ''}` });
    reload();
  };

  const remove = async (items: FinTransaction[]) => {
    if (!items.length) return;
    const ids = items.map(t => t.id);
    setRows(r => r.filter(t => !ids.includes(t.id)));
    setSelected(new Set());
    try {
      const res = await fetch(`/api/finance/transactions?ids=${ids.join(',')}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Delete failed');
      push({ text: `Deleted ${items.length} transaction${items.length > 1 ? 's' : ''}`, action: { label: 'Undo', run: () => restore(items) } }, 8000);
    } catch (e: any) {
      push({ text: e.message, tone: 'error' });
    }
    reload();
  };

  const exportCSV = async (only?: FinTransaction[]) => {
    const stamp = allDates ? 'all' : `${range.from}_to_${range.to}`;
    if (only) { downloadCSV(only, `transactions-selected-${stamp}.csv`); return; }
    setExporting(true);
    try {
      const p = new URLSearchParams(filterParams);
      p.set('export', '1'); p.set('sort', sort.key); p.set('dir', sort.dir);
      const j = await fetch(`/api/finance/transactions?${p}`).then(r => r.json());
      if (j.error) throw new Error(j.error);
      downloadCSV(j.transactions || [], `transactions-${stamp}.csv`);
      push({ text: `Exported ${j.transactions?.length ?? 0} rows` });
    } catch (e: any) {
      push({ text: `Export failed: ${e.message}`, tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' || key === 'amount' ? 'desc' : 'asc' }));

  const recentDescriptions = useMemo(() => [...new Set(rows.map(r => r.description))].slice(0, 30), [rows]);
  const selectedRows = rows.filter(r => selected.has(r.id));
  const selectedNet = selectedRows.reduce((s, t) => s + signed(t), 0);
  const allOnPageSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(type || category || method || search || allDates);
  const net = totals.income - totals.expense;

  const th = (label: string, key?: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      className={key ? 'fin-th-sort' : undefined}
      onClick={key ? () => toggleSort(key) : undefined}
      aria-sort={key && sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      style={{ padding: '10px 12px', textAlign: align, fontSize: '0.68rem', fontWeight: 800, color: sort.key === key ? '#0f172a' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap', background: '#f9fafb', position: 'sticky', top: 0 }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {key && sort.key === key && (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </span>
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { label: 'Money in', value: fmt(totals.income), color: '#15803d', hint: 'Income entries' },
          { label: 'Money out', value: fmt(totals.expense), color: '#b91c1c', hint: 'Expense entries' },
          { label: 'Net', value: fmt(net), color: net >= 0 ? '#0f172a' : '#b91c1c', hint: 'In − out (excl. transfers)' },
          { label: 'Transfers', value: `+${fmt(totals.transfer_in)} / −${fmt(totals.transfer_out)}`, color: '#1d4ed8', hint: 'Owner & loan movements' },
          { label: 'Entries', value: total.toLocaleString(), color: '#0f172a', hint: allDates ? 'All dates' : period.label },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '11px 14px' }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: s.label === 'Transfers' ? '0.88rem' : '1.15rem', fontWeight: 900, color: s.color, marginTop: 3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Actions + templates */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={() => openNew()} style={{ ...btnPrimary, padding: '9px 14px' }} title="Shortcut: N">
          <Plus size={15} /> New transaction <kbd style={{ marginLeft: 4, fontSize: '0.65rem', background: 'rgba(255,255,255,0.18)', borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit' }}>N</kbd>
        </button>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 2px 0 6px' }}>Quick:</span>
        {TEMPLATES.map(t => (
          <button key={t.label} type="button" onClick={() => openNew(t.form)}
            style={{ ...btnSecondary, padding: '7px 11px', fontWeight: 650, fontSize: '0.78rem' }}>
            <t.icon size={13} color="#64748b" /> {t.label}
          </button>
        ))}
        <button type="button" onClick={() => exportCSV()} disabled={exporting || total === 0}
          style={{ ...btnSecondary, padding: '7px 11px', marginLeft: 'auto', opacity: total === 0 ? 0.5 : 1 }}>
          {exporting ? <Spinner size={13} /> : <Download size={13} />} Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 220px', border: '1px solid #e2e7ee', borderRadius: 8, padding: '0 10px', background: '#f9fafb' }}>
          <Search size={14} color="#94a3b8" />
          <input type="search" aria-label="Search transactions" placeholder="Search description, reference, notes or exact amount…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.82rem', width: '100%', padding: '8px 0' }} />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><X size={13} /></button>}
        </div>
        <Segmented size="sm" value={type || 'all'} onChange={v => { setType(v === 'all' ? '' : v as TxType); setCategory(''); }} options={[
          { id: 'all', label: 'All' }, { id: 'income', label: 'In' }, { id: 'expense', label: 'Out' }, { id: 'transfer', label: 'Transfer' },
        ]} />
        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} style={{ ...selectStyle, width: 170, padding: '6px 8px' }}>
          <option value="">All categories</option>
          {(!type || type === 'income') && <optgroup label="Income">{Object.entries(INCOME_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>}
          {(!type || type === 'expense') && <optgroup label="Expense">{Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>}
          {(!type || type === 'transfer') && <optgroup label="Transfer">{Object.entries(TRANSFER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>}
        </select>
        <select aria-label="Payment method" value={method} onChange={e => setMethod(e.target.value)} style={{ ...selectStyle, width: 140, padding: '6px 8px' }}>
          <option value="">All methods</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={allDates} onChange={e => setAllDates(e.target.checked)} /> All dates
        </label>
        {hasFilters && (
          <button type="button" onClick={() => { setSearch(''); setType(''); setCategory(''); setMethod(''); setAllDates(false); }}
            style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '9px 14px', background: '#0f172a', color: '#fff', borderRadius: 10, fontSize: '0.8rem' }}>
          <b>{selected.size} selected</b>
          <span style={{ color: '#cbd5e1' }}>Net {fmt(selectedNet)}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => exportCSV(selectedRows)} style={{ ...btnSecondary, padding: '5px 10px', background: 'transparent', color: '#fff', borderColor: '#475569' }}><Download size={13} /> Export</button>
            <button type="button" onClick={() => remove(selectedRows)} style={{ ...btnSecondary, padding: '5px 10px', background: '#b91c1c', color: '#fff', borderColor: '#b91c1c' }}><Trash2 size={13} /> Delete</button>
            <button type="button" onClick={() => setSelected(new Set())} style={{ ...btnSecondary, padding: '5px 10px', background: 'transparent', color: '#fff', borderColor: '#475569' }}>Clear</button>
          </span>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden' }}>
        {loading && rows.length > 0 && <div className="fin-loading-bar" />}
        {loading && rows.length === 0 ? (
          <LoadingState bare label="Loading transactions…" />
        ) : error ? (
          <ErrorState bare message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
            <EmptyState bare icon={Receipt} title={hasFilters ? 'Nothing matches these filters' : `No transactions in ${period.label}`}
              hint={hasFilters ? 'Try clearing filters or ticking “All dates”.' : 'Log income or expenses to see them here.'} />
            <button type="button" onClick={() => openNew()} style={{ ...btnPrimary, marginTop: 4 }}><Plus size={14} /> New transaction</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '70vh', opacity: loading ? 0.6 : 1 }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', width: 34, borderBottom: '1px solid #e2e7ee', background: '#f9fafb', position: 'sticky', top: 0 }}>
                    <input type="checkbox" aria-label="Select all on page" checked={allOnPageSelected}
                      onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} />
                  </th>
                  {th('Date', 'date')}
                  {th('Description', 'description')}
                  {th('Category', 'category')}
                  {th('Method', 'payment_method')}
                  {th('Vendor')}
                  {th('Amount', 'amount', 'right')}
                  <th style={{ borderBottom: '1px solid #e2e7ee', background: '#f9fafb', position: 'sticky', top: 0, width: 96 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map(tx => {
                  const isSel = selected.has(tx.id);
                  const amt = signed(tx);
                  return (
                    <tr key={tx.id} className={`fin-row${isSel ? ' is-selected' : ''}`} onDoubleClick={() => openEdit(tx)}>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <input type="checkbox" aria-label={`Select ${tx.description}`} checked={isSel}
                          onChange={e => setSelected(s => { const n = new Set(s); if (e.target.checked) n.add(tx.id); else n.delete(tx.id); return n; })} />
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(`${tx.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: tx.date.slice(0, 4) === todayISO().slice(0, 4) ? undefined : '2-digit' })}
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9', maxWidth: 320 }}>
                        <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}
                          {tx.receipt_path && (
                            <a href={`/api/finance/receipts?id=${tx.id}`} target="_blank" rel="noreferrer" title="View receipt" onClick={e => e.stopPropagation()}
                              style={{ marginLeft: 6, color: '#2563eb', verticalAlign: -2, display: 'inline-flex' }}><Paperclip size={13} /></a>
                          )}
                          {tx.recurring_id && <span title="Posted automatically by a recurring entry" style={{ marginLeft: 5, color: '#94a3b8', verticalAlign: -2, display: 'inline-flex' }}><Repeat size={12} /></span>}
                        </div>
                        {(tx.reference_no || tx.notes) && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[tx.reference_no && `Ref ${tx.reference_no}`, tx.notes].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', whiteSpace: 'nowrap', color: '#334155' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: getCategoryColor(tx.category), flexShrink: 0 }} />
                          {getCategoryLabel(tx.category)}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: '0.77rem', color: '#64748b', whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9' }}>{tx.payment_method}</td>
                      <td style={{ padding: '9px 12px', fontSize: '0.77rem', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{tx.vendor_name || '—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, fontSize: '0.86rem', whiteSpace: 'nowrap', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontVariantNumeric: 'tabular-nums', color: tx.type === 'transfer' ? '#1d4ed8' : amt >= 0 ? '#15803d' : '#0f172a' }}>
                        {amt >= 0 ? '+' : '−'}{fmt(Math.abs(amt))}
                      </td>
                      <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        <span className="fin-row-actions" style={{ display: 'inline-flex', gap: 2 }}>
                          {[
                            { label: 'Edit', icon: Pencil, run: () => openEdit(tx) },
                            { label: 'Duplicate', icon: Copy, run: () => duplicate(tx) },
                            { label: 'Delete', icon: Trash2, run: () => remove([tx]) },
                          ].map(a => (
                            <button key={a.label} type="button" aria-label={`${a.label} ${tx.description}`} title={a.label} onClick={a.run}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: a.label === 'Delete' ? '#dc2626' : '#64748b', padding: 5, borderRadius: 6, display: 'flex' }}>
                              <a.icon size={14} />
                            </button>
                          ))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 14px', borderTop: '1px solid #f1f5f9', background: '#f9fafb', fontSize: '0.76rem', color: '#64748b' }}>
          <span>{total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total.toLocaleString()}</span>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <span>Double-click a row to edit</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <select aria-label="Rows per page" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ ...selectStyle, width: 'auto', padding: '4px 6px', fontSize: '0.76rem' }}>
              {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ ...btnSecondary, padding: '4px 7px', opacity: page <= 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
            <span>Page {page} of {pages}</span>
            <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ ...btnSecondary, padding: '4px 7px', opacity: page >= pages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
          </span>
        </div>
      </div>

      {editor && (
        <Editor
          initial={editor}
          vendors={vendors}
          recentDescriptions={recentDescriptions}
          onClose={() => setEditor(null)}
          onSaved={(msg, keepOpen) => { push({ text: msg }); if (!keepOpen) setEditor(null); reload(); }}
        />
      )}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
};
