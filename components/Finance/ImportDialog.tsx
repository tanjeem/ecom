'use client';

// Import a bank / bKash / Nagad statement (CSV) into the ledger:
// upload → map columns → review categories → preview (server dry run) → import.

import React, { useMemo, useRef, useState } from 'react';
import { Upload, X, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TRANSFER_CATEGORIES } from '@/lib/types/finance';
import { fmt, inputStyle, selectStyle, labelStyle, btnPrimary, btnSecondary, PAYMENT_METHODS } from './shared';
import { Spinner } from './ui';

type TxType = 'income' | 'expense' | 'transfer';
const CATS: Record<TxType, Record<string, string>> = { income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES, transfer: TRANSFER_CATEGORIES };

// ─── CSV ──────────────────────────────────────────────────────────────────────

function detectDelimiter(text: string) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, line.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** Quoted fields may contain the delimiter, escaped quotes and line breaks. */
function parseCSV(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field.trim()); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some((f) => f)) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field.trim());
  if (row.some((f) => f)) rows.push(row);
  return rows;
}

// ─── field parsing ───────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');

function parseDate(raw: string, dayFirst: boolean): string | null {
  const s = raw.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?$/i, '');
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
    const a = +r[1], b = +r[2];
    y = +r[3] < 100 ? 2000 + +r[3] : +r[3];
    [d, m] = dayFirst ? [a, b] : [b, a];
  } else if ((r = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{2,4})$/))) {
    d = +r[1]; m = MONTHS[r[2].toLowerCase()]; y = +r[3] < 100 ? 2000 + +r[3] : +r[3];
  } else if ((r = s.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/))) {
    m = MONTHS[r[1].toLowerCase()]; d = +r[2]; y = +r[3];
  } else return null;
  if (!m || m > 12 || !d || d > 31 || y < 2000 || y > 2100) return null;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** "1,234.50", "(500)", "-৳300", "BDT 1200 Dr" → signed number, or null. */
function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[^\d.-]/g, '')) || /\bdr\b/i.test(s);
  s = s.replace(/[^\d.]/g, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return null;
  return negative ? -n : n;
}

/** Category guess from the narration; returns null to use the type's default. */
function guessCategory(text: string, type: TxType): string | null {
  const t = text.toLowerCase();
  if (type === 'income') {
    if (/pathao/.test(t)) return 'pathao_payout';
    if (/bkash|nagad|rocket|payment received|sale/.test(t)) return 'sales_prepaid';
    return 'other_income';
  }
  if (type === 'expense') {
    if (/facebook|meta|fb ads|\bfb\b/.test(t)) return 'ads_meta';
    if (/google/.test(t)) return 'ads_google';
    if (/rent/.test(t)) return 'rent';
    if (/salary|wage/.test(t)) return 'salary';
    if (/fabric|kapor/.test(t)) return 'fabric';
    if (/button|zipper|label|accessor/.test(t)) return 'accessories';
    if (/sewing|tailor|factory|stitch|production|\bpcs\b/.test(t)) return 'sewing';
    if (/poly|packag|box|courier bag/.test(t)) return 'packaging_material';
    if (/uber|pathao ride|transport|cng|fuel/.test(t)) return 'transport';
    if (/photo|shoot|model/.test(t)) return 'photoshoot';
    return 'miscellaneous';
  }
  return null;
}

// ─── column mapping ──────────────────────────────────────────────────────────

type Mapping = { date: number; description: number; amount: number; debit: number; credit: number; reference: number };
const NONE = -1;

function guessMapping(headers: string[]): Mapping {
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h.toLowerCase()));
  const debit = find(/debit|withdraw|paid out|\bdr\b|money out/);
  const credit = find(/credit|deposit|received|\bcr\b|money in/);
  return {
    date: find(/date|time/),
    description: find(/desc|narration|particular|details|remark|purpose|memo/),
    amount: debit >= 0 && credit >= 0 ? NONE : find(/amount|amt|value/),
    debit: debit >= 0 && credit >= 0 ? debit : NONE,
    credit: debit >= 0 && credit >= 0 ? credit : NONE,
    reference: find(/ref|trx|transaction id|txn|cheque|invoice/),
  };
}

type Draft = {
  include: boolean; date: string | null; description: string; amount: number;
  type: TxType; category: string; reference_no: string; raw: string[];
};

type Verdict = { index: number; status: 'ok' | 'possible' | 'duplicate' | 'invalid'; error?: string };

// ─── component ───────────────────────────────────────────────────────────────

export function ImportDialog({ open, onClose, onImported }: {
  open: boolean;
  onClose: () => void;
  /** Called with the number of rows written */
  onImported?: (count: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [dayFirst, setDayFirst] = useState(true);
  const [method, setMethod] = useState<string>('Bank Transfer');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[] | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const headers = useMemo(() => (hasHeader ? table[0] ?? [] : (table[0] ?? []).map((_, i) => `Column ${i + 1}`)), [table, hasHeader]);
  const body = useMemo(() => (hasHeader ? table.slice(1) : table), [table, hasHeader]);

  const reset = () => {
    setFileName(''); setTable([]); setMapping(null); setDrafts(null); setVerdicts(null);
    setError(null); setDone(null); setBusy(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  const close = () => { reset(); onClose(); };

  if (!open) return null;

  const onFile = async (file: File) => {
    reset();
    if (file.size > 5_000_000) { setError('That file is over 5 MB — export a shorter date range.'); return; }
    const text = await file.text();
    const rows = parseCSV(text.replace(/^﻿/, ''));
    if (rows.length < 2) { setError('Couldn’t find any rows in that file. Is it a CSV export?'); return; }
    setFileName(file.name);
    setTable(rows);
    setMapping(guessMapping(rows[0]));
  };

  const buildDrafts = () => {
    if (!mapping) return;
    if (mapping.date < 0 || mapping.description < 0 || (mapping.amount < 0 && (mapping.debit < 0 || mapping.credit < 0))) {
      setError('Pick the date, description and amount columns (or both debit and credit).');
      return;
    }
    setError(null);
    const out: Draft[] = [];
    for (const r of body) {
      let signed: number | null;
      if (mapping.amount >= 0) signed = parseAmount(r[mapping.amount] ?? '');
      else {
        const out_ = parseAmount(r[mapping.debit] ?? '');
        const in_ = parseAmount(r[mapping.credit] ?? '');
        signed = in_ ? Math.abs(in_) : out_ ? -Math.abs(out_) : null;
      }
      if (signed == null) continue; // balance-only or blank lines
      const description = (r[mapping.description] ?? '').trim();
      const type: TxType = signed > 0 ? 'income' : 'expense';
      const category = guessCategory(description, type) ?? Object.keys(CATS[type])[0];
      const date = parseDate(r[mapping.date] ?? '', dayFirst);
      out.push({
        include: date != null && !!description,
        date, description, amount: Math.abs(signed), type, category,
        reference_no: mapping.reference >= 0 ? (r[mapping.reference] ?? '').trim() : '',
        raw: r,
      });
    }
    if (!out.length) { setError('No rows with an amount were found with this column mapping.'); return; }
    setDrafts(out);
    setVerdicts(null);
  };

  const update = (i: number, patch: Partial<Draft>) => {
    setDrafts((ds) => ds && ds.map((d, j) => {
      if (j !== i) return d;
      const next = { ...d, ...patch };
      if (patch.type && !(next.category in CATS[patch.type])) next.category = guessCategory(next.description, patch.type) ?? Object.keys(CATS[patch.type])[0];
      return next;
    }));
    setVerdicts(null);
  };

  const included = drafts?.filter((d) => d.include) ?? [];
  const payload = (dryRun: boolean) => ({
    dryRun,
    rows: included.map((d) => ({
      date: d.date, type: d.type, category: d.category, description: d.description,
      amount: d.amount, payment_method: method, reference_no: d.reference_no || undefined,
      notes: `Imported from ${fileName}`,
    })),
  });

  const send = async (dryRun: boolean) => {
    setBusy(dryRun ? 'preview' : 'import');
    setError(null);
    try {
      const res = await fetch('/api/finance/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(dryRun)) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Import failed (${res.status})`);
      // Map verdicts (indexed over included rows) back onto all drafts
      const all = drafts!;
      const map: Verdict[] = [];
      let k = 0;
      all.forEach((d, i) => { if (d.include) { map[i] = { ...json.verdicts[k], index: i }; k++; } });
      setVerdicts(map);
      if (dryRun) {
        // Untick duplicates and invalid rows so "Import" writes only the good ones
        setDrafts(all.map((d, i) => (map[i] && map[i].status !== 'ok' ? { ...d, include: false } : d)));
      } else {
        setDone(json.inserted);
        onImported?.(json.inserted);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(null);
    }
  };

  const totals = included.reduce((t, d) => { t[d.type] += d.amount; return t; }, { income: 0, expense: 0, transfer: 0 } as Record<TxType, number>);
  const colSelect = (key: keyof Mapping, label: string, optional = false) => (
    <label style={{ minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      <select value={mapping?.[key] ?? NONE} onChange={(e) => setMapping((m) => m && { ...m, [key]: Number(e.target.value) })} style={selectStyle}>
        <option value={NONE}>{optional ? '— none —' : '— pick a column —'}</option>
        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
    </label>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Import statement" className="imp-overlay"
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="imp-panel" style={{ background: '#fff', borderRadius: 14, width: 'min(1040px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #eef1f5' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Import statement</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Bank, bKash or Nagad CSV export → ledger transactions</div>
          </div>
          <button type="button" aria-label="Close" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 6 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {done != null ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <CheckCircle2 size={36} color="#16a34a" />
              <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 10 }}>Imported {done} transaction{done === 1 ? '' : 's'}</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 4 }}>Each is noted “Imported from {fileName}” so you can find them later.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                <button type="button" style={btnSecondary} onClick={reset}>Import another</button>
                <button type="button" style={btnPrimary} onClick={close}>Done</button>
              </div>
            </div>
          ) : (
            <>
              {/* step 1: file */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                <button type="button" style={btnSecondary} onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> {fileName ? 'Choose another file' : 'Choose CSV file'}
                </button>
                {fileName && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#334155' }}><FileText size={14} /> {fileName} · {body.length} rows</span>}
                {!fileName && <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Download the statement from your bank or bKash app as CSV (Excel: File → Save as → CSV).</span>}
              </div>

              {/* step 2: columns */}
              {mapping && (
                <div style={{ border: '1px solid #e2e7ee', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10 }}>Match the columns</div>
                  <div className="imp-map" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                    {colSelect('date', 'Date')}
                    {colSelect('description', 'Description')}
                    {colSelect('amount', 'Amount (signed)', true)}
                    {colSelect('debit', 'Or: money out', true)}
                    {colSelect('credit', 'Or: money in', true)}
                    {colSelect('reference', 'Reference / Trx ID', true)}
                    <label>
                      <span style={labelStyle}>Paid via</span>
                      <select value={method} onChange={(e) => setMethod(e.target.value)} style={selectStyle}>
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </label>
                    <label>
                      <span style={labelStyle}>Date format</span>
                      <select value={dayFirst ? 'd' : 'm'} onChange={(e) => setDayFirst(e.target.value === 'd')} style={selectStyle}>
                        <option value="d">Day first (31/12/2026)</option>
                        <option value="m">Month first (12/31/2026)</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#475569' }}>
                      <input type="checkbox" checked={hasHeader} onChange={(e) => { setHasHeader(e.target.checked); setDrafts(null); }} /> First row is column names
                    </label>
                    <button type="button" style={btnPrimary} onClick={buildDrafts}>{drafts ? 'Re-read rows' : 'Read rows'}</button>
                  </div>
                </div>
              )}

              {error && (
                <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 9, background: '#fef2f2', color: '#b91c1c', fontSize: '0.82rem' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                </div>
              )}

              {/* step 3: review */}
              {drafts && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Review {drafts.length} rows</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {included.length} selected · <span style={{ color: '#15803d' }}>in {fmt(totals.income)}</span> · <span style={{ color: '#b91c1c' }}>out {fmt(totals.expense)}</span>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e7ee', borderRadius: 10 }}>
                    <table style={{ minWidth: 820, width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '8px 10px', width: 30 }}>
                            <input type="checkbox" aria-label="Select all rows" checked={included.length === drafts.length}
                              onChange={(e) => { setDrafts(drafts.map((d) => ({ ...d, include: e.target.checked && d.date != null }))); setVerdicts(null); }} />
                          </th>
                          <th style={{ padding: '8px 6px' }}>Date</th>
                          <th style={{ padding: '8px 6px' }}>Description</th>
                          <th style={{ padding: '8px 6px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '8px 6px' }}>Type</th>
                          <th style={{ padding: '8px 6px' }}>Category</th>
                          <th style={{ padding: '8px 6px' }}>Check</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drafts.map((d, i) => {
                          const v = verdicts?.[i];
                          return (
                            <tr key={i} style={{ borderTop: '1px solid #f1f5f9', opacity: d.include ? 1 : 0.5 }}>
                              <td style={{ padding: '6px 10px' }}>
                                <input type="checkbox" aria-label={`Include row ${i + 1}`} checked={d.include} disabled={d.date == null}
                                  onChange={(e) => update(i, { include: e.target.checked })} />
                              </td>
                              <td style={{ padding: '6px', whiteSpace: 'nowrap', color: d.date ? '#0f172a' : '#b91c1c' }} title={d.raw[mapping!.date]}>
                                {d.date ?? `Can't read “${d.raw[mapping!.date] ?? ''}”`}
                              </td>
                              <td style={{ padding: '6px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.description}>{d.description}</td>
                              <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: d.type === 'income' ? '#15803d' : d.type === 'expense' ? '#b91c1c' : '#334155' }}>{fmt(d.amount)}</td>
                              <td style={{ padding: '6px' }}>
                                <select value={d.type} onChange={(e) => update(i, { type: e.target.value as TxType })} style={{ ...selectStyle, padding: '4px 6px', fontSize: '0.76rem' }}>
                                  <option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px' }}>
                                <select value={d.category} onChange={(e) => update(i, { category: e.target.value })} style={{ ...selectStyle, padding: '4px 6px', fontSize: '0.76rem' }}>
                                  {Object.entries(CATS[d.type]).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '6px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: !v ? '#94a3b8' : v.status === 'ok' ? '#15803d' : v.status === 'invalid' ? '#b91c1c' : '#b45309' }}
                                title={v?.error}>
                                {!v ? '—' : v.status === 'ok' ? 'Ready' : v.status === 'possible' ? `Possible duplicate — ${v.error}` : v.error}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {verdicts && (
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 8 }}>
                      Duplicates and possible duplicates were unticked. Tick a possible duplicate again if it really is a separate transaction.
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 6 }}>
                    Pathao payouts get the invoice id from the description as their reference, so the Payouts check can match them.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* footer */}
        {drafts && done == null && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #eef1f5', flexWrap: 'wrap' }}>
            <button type="button" style={btnSecondary} onClick={close}>Cancel</button>
            <button type="button" style={btnSecondary} disabled={!included.length || busy != null} onClick={() => send(true)}>
              {busy === 'preview' ? <Spinner size={13} /> : null} Check for duplicates
            </button>
            <button type="button" style={{ ...btnPrimary, opacity: !included.length || !verdicts || busy ? 0.5 : 1 }}
              disabled={!included.length || !verdicts || busy != null} onClick={() => send(false)}
              title={!verdicts ? 'Check for duplicates first' : undefined}>
              {busy === 'import' ? <Spinner size={13} /> : null} Import {included.length} row{included.length === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
      <style>{`
        @media (max-width: 760px) {
          .imp-overlay { padding: 0 !important; align-items: stretch !important; }
          .imp-panel { border-radius: 0 !important; max-height: 100vh !important; height: 100%; }
        }
      `}</style>
    </div>
  );
}
