import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TRANSFER_CATEGORIES } from '@/lib/types/finance';

// Bulk import of bank / bKash statement rows into fin_transactions.
// POST { rows, dryRun } — dryRun returns a per-row verdict without writing.
// A row is a duplicate when the ledger (or an earlier row in the same file)
// already has the same date and amount, and either the same reference_no or,
// when either side has no reference, the same description. Same date and
// amount with a different description is only a *possible* duplicate: it's
// reported in the preview but still imported if the user keeps it ticked.

const MAX_ROWS = 2000;
const INSERT_CHUNK = 500;
const METHODS = new Set(['Cash', 'Bank Transfer', 'bKash', 'Nagad', 'Card', 'Cheque']);
const CATEGORIES: Record<string, Record<string, string>> = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  transfer: TRANSFER_CATEGORIES,
};
// Pathao payment invoice ids look like 300926SUFRGCO (ddmmyy + 7 letters)
const PATHAO_INVOICE = /\b\d{6}[A-Z]{7}\b/;

type InRow = {
  date?: string; type?: string; category?: string; description?: string;
  amount?: number | string; payment_method?: string; reference_no?: string; notes?: string;
};

type Clean = {
  date: string; type: string; category: string; description: string; amount: number;
  payment_method: string; reference_no: string | null; notes: string | null;
};

export type ImportVerdict = { index: number; status: 'ok' | 'possible' | 'duplicate' | 'invalid'; error?: string; reference_no?: string | null };

function clean(r: InRow): Clean | string {
  const date = String(r.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return 'Date must be YYYY-MM-DD';
  const type = String(r.type ?? '');
  if (!CATEGORIES[type]) return 'Type must be income, expense or transfer';
  const category = String(r.category ?? '');
  if (!(category in CATEGORIES[type])) return `“${category}” isn’t a valid ${type} category`;
  const description = String(r.description ?? '').trim().slice(0, 500);
  if (!description) return 'Description is empty';
  const amount = Math.round(Number(r.amount) * 100) / 100;
  if (!(amount > 0)) return 'Amount must be greater than 0';
  const payment_method = String(r.payment_method ?? '');
  if (!METHODS.has(payment_method)) return 'Unknown payment method';
  let reference_no = String(r.reference_no ?? '').trim().slice(0, 120) || null;
  // Payouts must carry the invoice id so /api/finance/payouts can match them
  if (category === 'pathao_payout' && !reference_no) reference_no = description.match(PATHAO_INVOICE)?.[0] ?? null;
  const notes = String(r.notes ?? '').trim().slice(0, 1000) || null;
  return { date, type, category, description, amount, payment_method, reference_no, notes };
}

const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

function sameEntry(a: { date: string; amount: number; reference_no: string | null; description: string }, b: typeof a) {
  if (a.date !== b.date || Math.abs(a.amount - b.amount) > 0.005) return false;
  if (a.reference_no && b.reference_no) return norm(a.reference_no) === norm(b.reference_no);
  return norm(a.description) === norm(b.description);
}

export async function POST(req: NextRequest) {
  let body: { rows?: InRow[]; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `At most ${MAX_ROWS} rows per import` }, { status: 400 });

  const cleaned = rows.map(clean);
  const valid = cleaned.filter((c): c is Clean => typeof c !== 'string');

  // Existing ledger rows in the file's date span, for the duplicate check
  const existing: { date: string; amount: number; reference_no: string | null; description: string }[] = [];
  if (valid.length) {
    const dates = valid.map((v) => v.date).sort();
    for (let offset = 0; offset < 50_000; offset += 1000) {
      const { data, error } = await supabase
        .from('fin_transactions')
        .select('date, amount, reference_no, description')
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1])
        .order('id')
        .range(offset, offset + 999);
      if (error) return NextResponse.json({ error: `Could not check for duplicates: ${error.message}` }, { status: 500 });
      existing.push(...(data ?? []).map((d) => ({ ...d, amount: Number(d.amount) })));
      if (!data || data.length < 1000) break;
    }
  }

  const accepted: Clean[] = [];
  const verdicts: ImportVerdict[] = cleaned.map((c, index) => {
    if (typeof c === 'string') return { index, status: 'invalid', error: c };
    if (existing.some((e) => sameEntry(e, c))) return { index, status: 'duplicate', error: 'Already in the ledger', reference_no: c.reference_no };
    if (accepted.some((a) => sameEntry(a, c))) return { index, status: 'duplicate', error: 'Repeated in this file', reference_no: c.reference_no };
    accepted.push(c);
    const lookalike = existing.find((e) => e.date === c.date && Math.abs(e.amount - c.amount) <= 0.005);
    if (lookalike) return { index, status: 'possible', error: `Same date & amount as “${lookalike.description.slice(0, 40)}”`, reference_no: c.reference_no };
    return { index, status: 'ok', reference_no: c.reference_no };
  });

  const summary = {
    ok: accepted.length,
    possible: verdicts.filter((v) => v.status === 'possible').length,
    duplicate: verdicts.filter((v) => v.status === 'duplicate').length,
    invalid: verdicts.filter((v) => v.status === 'invalid').length,
  };

  if (body.dryRun) return NextResponse.json({ dryRun: true, verdicts, summary });

  let inserted = 0;
  for (let i = 0; i < accepted.length; i += INSERT_CHUNK) {
    const chunk = accepted.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from('fin_transactions').insert(chunk);
    if (error) {
      return NextResponse.json({
        error: `Stopped after ${inserted} rows: ${error.message}`,
        inserted, verdicts, summary,
      }, { status: 500 });
    }
    inserted += chunk.length;
  }
  return NextResponse.json({ dryRun: false, inserted, verdicts, summary });
}
