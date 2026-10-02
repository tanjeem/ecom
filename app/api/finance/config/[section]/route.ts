import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { invalidateServerFinanceCaches } from '@/lib/finance/cache';

// CRUD for the finance configuration tables. Each section lists exactly which
// columns a client may write, and how to validate them.

type Section = {
  table: string;
  order: string;
  fields: Record<string, (v: any) => any>; // returns the cleaned value, or throws
};

const str = (max = 200) => (v: any) => { const s = String(v ?? '').trim(); if (!s) throw new Error('required'); return s.slice(0, max); };
const optStr = (max = 200) => (v: any) => (v == null || v === '' ? null : String(v).trim().slice(0, max));
const money = (min = 0) => (v: any) => { const n = Number(v); if (!Number.isFinite(n) || n < min) throw new Error(`must be a number ≥ ${min}`); return Math.round(n * 100) / 100; };
const month = (optional: boolean) => (v: any) => {
  if ((v == null || v === '') && optional) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v))) throw new Error('must be YYYY-MM');
  return String(v);
};
const oneOf = (...opts: string[]) => (v: any) => { if (!opts.includes(v)) throw new Error(`must be one of ${opts.join(', ')}`); return v; };
const bool = (v: any) => !!v;
const int = (min: number, max: number) => (v: any) => { const n = Number.parseInt(v, 10); if (!(n >= min && n <= max)) throw new Error(`must be ${min}–${max}`); return n; };
const date = (v: any) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Error('must be YYYY-MM-DD'); return String(v); };
const strList = (v: any) => (Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, 20) : []);

const SECTIONS: Record<string, Section> = {
  accounts: {
    table: 'fin_accounts',
    order: 'sort_order',
    fields: {
      name: str(80), kind: oneOf('cash', 'bank', 'mobile', 'card'), payment_methods: strList,
      opening_balance: money(-1e12), opening_date: date, sort_order: int(0, 1000), is_active: bool,
    },
  },
  budgets: {
    table: 'fin_budgets',
    order: 'scope',
    fields: {
      month: month(true),
      scope: oneOf('revenue', 'production', 'marketing', 'overhead', 'logistics', 'other'),
      amount: money(0),
    },
  },
  recurring: {
    table: 'fin_recurring',
    order: 'created_at',
    fields: {
      description: str(200), type: oneOf('income', 'expense', 'transfer'), category: str(60), amount: money(0.01),
      payment_method: str(40), vendor_id: optStr(60), day_of_month: int(1, 28), start_month: month(false),
      end_month: month(true), is_active: bool,
    },
  },
};

const SETTINGS: Record<string, (v: any) => any> = {
  cogs_method: oneOf('per_unit', 'cash'),
  default_unit_cost: (v: any) => (v == null || v === '' ? null : money(0)(v)),
  pathao_payout_account: optStr(60),
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === 'settings') {
    const { data, error } = await supabase.from('fin_settings').select('key, value');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: Object.fromEntries((data || []).map((r: any) => [r.key, r.value])) });
  }
  const s = SECTIONS[section];
  if (!s) return NextResponse.json({ error: 'Unknown section' }, { status: 404 });
  const { data, error } = await supabase.from(s.table).select('*').order(s.order);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

/** Create (no id) or update (with id). Settings: { key, value }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  if (section === 'settings') {
    const clean = SETTINGS[body?.key];
    if (!clean) return NextResponse.json({ error: 'Unknown setting' }, { status: 400 });
    let value;
    try { value = clean(body.value); } catch (e: any) { return NextResponse.json({ error: `${body.key} ${e.message}` }, { status: 400 }); }
    const { error } = await supabase.from('fin_settings').upsert({ key: body.key, value, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateServerFinanceCaches();
    return NextResponse.json({ ok: true });
  }

  const s = SECTIONS[section];
  if (!s) return NextResponse.json({ error: 'Unknown section' }, { status: 404 });
  const row: Record<string, any> = {};
  for (const [k, clean] of Object.entries(s.fields)) {
    if (!(k in body)) continue;
    try { row[k] = clean(body[k]); } catch (e: any) { return NextResponse.json({ error: `${k} ${e.message}` }, { status: 400 }); }
  }

  const q = body.id
    ? supabase.from(s.table).update(row).eq('id', body.id).select().single()
    : supabase.from(s.table).insert(row).select().single();
  const { data, error } = await q;
  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json({ error: dup ? 'An entry for that month and scope already exists' : error.message }, { status: dup ? 409 : 500 });
  }
  invalidateServerFinanceCaches();
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = SECTIONS[section];
  const id = req.nextUrl.searchParams.get('id');
  if (!s || !id) return NextResponse.json({ error: 'section and id required' }, { status: 400 });
  const { error } = await supabase.from(s.table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateServerFinanceCaches();
  return NextResponse.json({ ok: true });
}
