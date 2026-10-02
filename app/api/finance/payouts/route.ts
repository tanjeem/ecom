import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPathaoInvoiceLines } from '@/lib/integrations/pathao';
import { addDays, todayISO } from '@/lib/finance/periods';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const METHODS = new Set(['Cash', 'Bank Transfer', 'bKash', 'Nagad', 'Card', 'Cheque']);

/**
 * Pathao payout check: every paid invoice against the money you confirmed
 * arriving. A confirmation is a `pathao_payout` ledger row whose reference is
 * the invoice id (P&L ignores those rows — the invoice is the revenue record).
 * Rows without a reference are matched by amount (±৳1) within 7 days.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const today = todayISO();
  const from = ISO.test(sp.get('from') || '') ? sp.get('from')! : addDays(today, -89);
  const to = ISO.test(sp.get('to') || '') ? sp.get('to')! : today;
  try {
    const [lines, ledgerRes] = await Promise.all([
      getPathaoInvoiceLines(),
      supabase.from('fin_transactions').select('id, date, amount, payment_method, reference_no, description')
        .eq('category', 'pathao_payout').gte('date', addDays(from, -10)).lte('date', addDays(to, 10)),
    ]);
    if (ledgerRes.error) throw new Error(ledgerRes.error.message);

    const invoices = new Map<string, { id: string; created: string; paid: string | null; collected: number; fees: number; payout: number; deliveries: number; returns: number }>();
    for (const l of lines) {
      const inv = invoices.get(l.invoice_id) || { id: l.invoice_id, created: l.invoice_date, paid: l.paid_date, collected: 0, fees: 0, payout: 0, deliveries: 0, returns: 0 };
      inv.collected += l.collected; inv.fees += l.fee; inv.payout += l.payout;
      if (l.type === 'delivery') inv.deliveries++; else inv.returns++;
      invoices.set(l.invoice_id, inv);
    }
    const inRange = [...invoices.values()].filter(i => (i.paid || i.created) >= from && (i.paid || i.created) <= to)
      .sort((a, b) => (b.paid || b.created).localeCompare(a.paid || a.created));

    const ledger = (ledgerRes.data || []).map(r => ({ ...r, amount: Number(r.amount), used: false }));
    const byRef = new Map(ledger.filter(r => r.reference_no).map(r => [String(r.reference_no), r]));
    const rows = inRange.map(i => {
      let match = byRef.get(i.id);
      if (!match && i.paid) {
        match = ledger.find(r => !r.used && !r.reference_no && Math.abs(r.amount - i.payout) <= 1
          && r.date >= addDays(i.paid!, -2) && r.date <= addDays(i.paid!, 7));
      }
      if (match) match.used = true;
      const status = match ? (Math.abs(match.amount - i.payout) <= 1 ? 'confirmed' : 'mismatch')
        : !i.paid ? 'pending'
        : i.paid < addDays(today, -3) ? 'unconfirmed_old' : 'unconfirmed';
      return { ...i, status, confirmation: match ? { id: match.id, date: match.date, amount: match.amount, method: match.payment_method } : null };
    });
    const unmatched = ledger.filter(r => !r.used && (!r.reference_no || !invoices.has(String(r.reference_no))));

    const sum = (f: (r: typeof rows[number]) => boolean) => rows.filter(f).reduce((s, r) => s + r.payout, 0);
    return NextResponse.json({
      range: { from, to },
      invoices: rows,
      unmatchedDeposits: unmatched.map(({ used, ...r }) => r),
      totals: {
        paid: sum(r => !!r.paid),
        confirmed: sum(r => r.status === 'confirmed'),
        unconfirmed: sum(r => r.status === 'unconfirmed' || r.status === 'unconfirmed_old'),
        pending: sum(r => r.status === 'pending'),
        count: rows.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not load payouts' }, { status: 500 });
  }
}

/** Confirm invoices as received: one `pathao_payout` ledger row each, dated on the payout day. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.invoice_ids) ? body.invoice_ids.map(String).slice(0, 200) : [];
    const method = METHODS.has(body.payment_method) ? body.payment_method : 'bKash';
    if (!ids.length) return NextResponse.json({ error: 'invoice_ids required' }, { status: 400 });

    const lines = await getPathaoInvoiceLines();
    const { data: existing } = await supabase.from('fin_transactions').select('reference_no').eq('category', 'pathao_payout').in('reference_no', ids);
    const done = new Set((existing || []).map(r => String(r.reference_no)));

    const rows = ids.filter(id => !done.has(id)).map(id => {
      const ls = lines.filter(l => l.invoice_id === id);
      if (!ls.length) return null;
      const payout = Math.round(ls.reduce((s, l) => s + l.payout, 0) * 100) / 100;
      return {
        date: ls[0].paid_date || ls[0].invoice_date, type: 'income', category: 'pathao_payout', amount: payout,
        description: `Pathao payout · invoice ${id}`, payment_method: method, reference_no: id,
      };
    }).filter((r): r is NonNullable<typeof r> => !!r && r.amount > 0);

    if (!rows.length) return NextResponse.json({ created: 0 });
    const { error } = await supabase.from('fin_transactions').insert(rows);
    if (error) throw new Error(error.message);
    return NextResponse.json({ created: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not confirm payouts' }, { status: 500 });
  }
}
