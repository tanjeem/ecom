import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPathaoInvoiceLines, snapshotInvoiceIds } from '@/lib/integrations/pathao';
import { addMonths, todayISO } from '@/lib/finance/periods';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily finance housekeeping (Vercel cron, see vercel.json):
 * 1. Saves newly paid Pathao invoices to Supabase, so production keeps full
 *    invoice history without re-running scripts/sync-pathao-invoices.mjs.
 * 2. Posts recurring transactions that have come due. Safe to run repeatedly —
 *    a unique index allows one posting per entry per month.
 */
export async function GET() {
  const report: Record<string, unknown> = {};

  // 1. Pathao invoices
  try {
    const inSnapshot = snapshotInvoiceIds();
    const fresh = (await getPathaoInvoiceLines()).filter(l => !inSnapshot.has(l.invoice_id) && l.invoice_created_at);
    for (let i = 0; i < fresh.length; i += 500) {
      const { error } = await supabase.from('fin_pathao_invoice_lines').upsert(
        fresh.slice(i, i + 500).map(l => ({
          invoice_id: l.invoice_id,
          consignment_id: l.consignment_id,
          invoice_created_at: l.invoice_created_at,
          invoice_paid_at: l.invoice_paid_at,
          invoice_type: l.type,
          merchant_order_id: l.merchant_order_id || null,
          collected_amount: l.collected,
          final_fee: l.fee,
          payout: l.payout,
        })),
        { onConflict: 'invoice_id,consignment_id' },
      );
      if (error) throw new Error(error.message);
    }
    report.pathaoInvoiceLinesSaved = fresh.length;
  } catch (e: any) {
    report.pathaoError = e.message;
  }

  // 2. Recurring transactions
  try {
    const today = todayISO();
    const thisMonth = today.slice(0, 7);
    const { data: entries, error } = await supabase.from('fin_recurring').select('*').eq('is_active', true);
    if (error) throw new Error(error.message);
    let posted = 0;
    for (const r of entries || []) {
      const after = r.last_posted_month ? addMonths(`${r.last_posted_month}-01`, 1).slice(0, 7) : r.start_month;
      let month = after < r.start_month ? r.start_month : after;
      let last = r.last_posted_month;
      // Catch up on any missed months, up to the current one once its day arrives
      while (month <= thisMonth && (!r.end_month || month <= r.end_month)) {
        const date = `${month}-${String(r.day_of_month).padStart(2, '0')}`;
        if (date > today) break;
        const { error: insErr } = await supabase.from('fin_transactions').insert({
          date, type: r.type, category: r.category, description: r.description, amount: r.amount,
          payment_method: r.payment_method, vendor_id: r.vendor_id, recurring_id: r.id, recurring_month: month,
          notes: 'Posted automatically (recurring)',
        });
        if (insErr && insErr.code !== '23505') throw new Error(insErr.message); // 23505: already posted
        if (!insErr) posted++;
        last = month;
        month = addMonths(`${month}-01`, 1).slice(0, 7);
      }
      if (last !== r.last_posted_month) await supabase.from('fin_recurring').update({ last_posted_month: last }).eq('id', r.id);
    }
    report.recurringPosted = posted;
  } catch (e: any) {
    report.recurringError = e.message;
  }

  const ok = !report.pathaoError && !report.recurringError;
  return NextResponse.json({ ok, ...report, ranAt: new Date().toISOString() }, { status: ok ? 200 : 500 });
}
