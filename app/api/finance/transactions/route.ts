import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const SORTABLE = new Set(['date', 'amount', 'category', 'description', 'payment_method', 'type']);
const TYPES = new Set(['income', 'expense', 'transfer']);
const TRANSFER_IN = new Set(['owner_investment', 'loan_received']);
const PAGE = 1000;

type Filters = {
  dateFrom: string | null; dateTo: string | null; type: string | null;
  category: string | null; method: string | null; q: string;
};

function readFilters(sp: URLSearchParams): Filters {
  return {
    dateFrom: sp.get('date_from'),
    dateTo: sp.get('date_to'),
    type: sp.get('type'),
    category: sp.get('category'),
    method: sp.get('method'),
    // Strip characters that would break PostgREST's or() filter syntax
    q: (sp.get('q') || '').replace(/[,()%*\\]/g, ' ').trim(),
  };
}

function applyFilters<Q extends { gte: any; lte: any; eq: any; in: any; or: any }>(query: Q, f: Filters): Q {
  let q: any = query;
  if (f.dateFrom) q = q.gte('date', f.dateFrom);
  if (f.dateTo) q = q.lte('date', f.dateTo);
  if (f.type) q = q.eq('type', f.type);
  if (f.category) q = q.in('category', f.category.split(','));
  if (f.method) q = q.eq('payment_method', f.method);
  if (f.q) {
    const amount = Number(f.q);
    const parts = [`description.ilike.%${f.q}%`, `reference_no.ilike.%${f.q}%`, `notes.ilike.%${f.q}%`];
    if (Number.isFinite(amount) && amount > 0) parts.push(`amount.eq.${amount}`);
    q = q.or(parts.join(','));
  }
  return q;
}

const shape = (t: any) => ({ ...t, amount: Number(t.amount), vendor_name: t.fin_vendors?.name ?? null, fin_vendors: undefined });

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const f = readFilters(sp);
  const sort = SORTABLE.has(sp.get('sort') || '') ? sp.get('sort')! : 'date';
  const ascending = sp.get('dir') === 'asc';
  const exportAll = sp.get('export') === '1';
  // Legacy callers pass `limit` only
  const pageSize = Math.min(Math.max(Number.parseInt(sp.get('page_size') || sp.get('limit') || '50', 10) || 50, 1), 500);
  const page = Math.max(Number.parseInt(sp.get('page') || '1', 10) || 1, 1);

  const ordered = (q: any) => {
    q = q.order(sort, { ascending });
    if (sort !== 'date') q = q.order('date', { ascending: false });
    return q.order('created_at', { ascending: false });
  };

  if (exportAll) {
    const rows: any[] = [];
    for (let offset = 0; offset < 50_000; offset += PAGE) {
      const { data, error } = await ordered(applyFilters(supabase.from('fin_transactions').select('*, fin_vendors(name)'), f))
        .range(offset, offset + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows.push(...(data || []).map(shape));
      if (!data || data.length < PAGE) break;
    }
    return NextResponse.json({ transactions: rows, total: rows.length });
  }

  const start = (page - 1) * pageSize;
  const pageQuery = ordered(applyFilters(supabase.from('fin_transactions').select('*, fin_vendors(name)', { count: 'exact' }), f))
    .range(start, start + pageSize - 1);

  // Totals cover the whole filtered set, not just the visible page
  const totalsPromise = (async () => {
    const totals = { income: 0, expense: 0, transfer_in: 0, transfer_out: 0 };
    for (let offset = 0; offset < 100_000; offset += PAGE) {
      const { data, error } = await applyFilters(supabase.from('fin_transactions').select('type, category, amount'), f)
        .order('id')
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const t of data || []) {
        const a = Number(t.amount) || 0;
        if (t.type === 'income') totals.income += a;
        else if (t.type === 'expense') totals.expense += a;
        else if (TRANSFER_IN.has(t.category)) totals.transfer_in += a;
        else totals.transfer_out += a;
      }
      if (!data || data.length < PAGE) break;
    }
    return totals;
  })();

  try {
    const [{ data, error, count }, totals] = await Promise.all([pageQuery, totalsPromise]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      transactions: (data || []).map(shape),
      total: count ?? 0,
      page,
      page_size: pageSize,
      totals,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function validate(body: any): string | null {
  const { date, type, category, description, amount } = body;
  if (!date || !type || !category || !description || !amount) {
    return 'Missing required fields: date, type, category, description, amount';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'date must be YYYY-MM-DD';
  if (!TYPES.has(type)) return 'type must be income, expense, or transfer';
  if (!(Number(amount) > 0)) return 'amount must be greater than 0';
  return null;
}

const toRow = (body: any) => ({
  date: body.date,
  type: body.type,
  category: body.category,
  description: String(body.description).trim(),
  amount: Number(body.amount),
  payment_method: body.payment_method || 'Cash',
  vendor_id: body.vendor_id || null,
  reference_no: body.reference_no || null,
  notes: body.notes || null,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validate(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const { data, error } = await supabase.from('fin_transactions').insert(toRow(body)).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transaction: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const err = validate(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const { data, error } = await supabase.from('fin_transactions').update(toRow(body)).eq('id', body.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transaction: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const ids = (sp.get('ids') || sp.get('id') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
  if (ids.length > 500) return NextResponse.json({ error: 'At most 500 ids per request' }, { status: 400 });

  const { error } = await supabase.from('fin_transactions').delete().in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted: ids.length });
}
