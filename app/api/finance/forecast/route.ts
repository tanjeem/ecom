import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dashboardCache } from '@/lib/cache';
import { getCashPosition } from '@/lib/finance/position';
import { buildFinanceSummary, fetchTransactions } from '@/lib/finance/summary';
import { addDays, todayISO } from '@/lib/finance/periods';
import { getPathaoInvoiceLines, getPathaoPortalOrders, pathaoFetch } from '@/lib/integrations/pathao';
import { COGS_CATEGORIES } from '@/lib/types/finance';

export const dynamic = 'force-dynamic';

const CLOSED = new Set([
  'Delivered', 'Partial Delivery', 'Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit',
  'Paid Return', 'Pickup Cancel', 'Pickup Cancelled', 'Cancelled', 'Payment Invoice', 'Delivery Failed',
]);

/**
 * Ingredients for a 90-day cash forecast. The browser combines them (so the
 * what-if sliders are instant):
 * - start: today's cash across accounts
 * - pipeline: money Pathao already owes (invoice summary) plus COD on parcels
 *   still in transit, discounted by the return rate — lands over the next ~10 days
 * - daily run-rates from recent history: Pathao payouts, Meta ads, production
 *   purchases, other variable spend
 * - fixed costs (monthly) and recurring transactions on their day of month
 */
export async function GET(req: NextRequest) {
  const cached = dashboardCache.get<any>('finance_forecast_v1');
  if (cached && req.nextUrl.searchParams.get('refresh') !== '1') return NextResponse.json(cached);
  try {
    const today = todayISO();
    const from60 = addDays(today, -59);
    const from90 = addDays(today, -89);
    const [position, summary, txs, lines, fixedRes, recurringRes, invoiceRes, portalRes] = await Promise.all([
      getCashPosition(),
      buildFinanceSummary({ from: from60, to: today, granularity: 'week' }),
      fetchTransactions(from90, today),
      getPathaoInvoiceLines().catch(() => []),
      supabase.from('fin_fixed_costs').select('id, label, category, default_amount'),
      supabase.from('fin_recurring').select('id, description, type, category, amount, day_of_month, start_month, end_month, is_active').eq('is_active', true),
      pathaoFetch<any>('/merchant/invoice-summary').catch(() => null),
      getPathaoPortalOrders().catch(() => []),
    ]);

    // Pathao payouts per day over the last 60 days (by payout date)
    let payouts60 = 0;
    for (const l of lines) if (l.paid_date && l.paid_date >= from60 && l.paid_date <= today) payouts60 += l.payout;

    const fixedCats = new Set((fixedRes.data || []).map((f: any) => f.category));
    let production90 = 0;
    let other90 = 0;
    for (const t of txs) {
      if (t.type !== 'expense') continue;
      if (COGS_CATEGORIES.includes(t.category)) production90 += t.amount;
      else if (t.category === 'ads_meta' && summary.sources.meta === 'api') continue; // from the API below
      else if (!fixedCats.has(t.category)) other90 += t.amount;
    }
    const elapsed60 = Math.max(1, summary.range.elapsedDays);
    const metaPerDay = (summary.pl.opex.ads_meta || 0) / elapsed60;

    // Money Pathao holds today
    const d = invoiceRes?.data;
    const holding = d ? {
      inReview: Number(d.payment_in_review) || 0,
      preparing: Number(d.payment_preparing_for_invoice) || 0,
      inProcess: Number(d.payment_in_process) || 0,
      lastPayment: { amount: Number(d.payment_sent) || 0, date: d.last_invoice_date || null, method: d.payment_method_name || null },
      lifetime: Number(d.lifetime_earning) || 0,
    } : null;

    // Parcels still out with Pathao: expected COD after returns and fees
    const recent = addDays(today, -45);
    let transitCount = 0;
    let transitCod = 0;
    let transitFees = 0;
    for (const o of portalRes) {
      const day = o.order_created_at?.slice(0, 10);
      if (!day || day < recent || o.order_type === 'Return' || /^R[SE]/.test(o.order_consignment_id || '') || CLOSED.has(o.order_status)) continue;
      transitCount++;
      transitCod += Number(o.order_amount) || 0;
      transitFees += Number(o.total_fee) || Number(o.delivery_fee) || 0;
    }
    const returnRate = summary.orders.returnRate / 100;
    const transitExpected = Math.max(0, transitCod * (1 - returnRate) - transitFees);

    const monthlyFixed = (fixedRes.data || []).map((f: any) => ({ name: f.label || f.category, category: f.category, amount: Number(f.default_amount) || 0 }))
      .filter((f: any) => f.amount > 0);

    const body = {
      asOf: today,
      start: { cash: position.totalCash, accounts: position.accounts.length, vendorDue: position.totalVendorDue },
      pipeline: {
        holding,
        holdingTotal: holding ? holding.inReview + holding.preparing + holding.inProcess : 0,
        transit: { count: transitCount, cod: transitCod, fees: transitFees, returnRate: summary.orders.returnRate, expected: transitExpected },
      },
      rates: {
        payoutsPerDay: payouts60 / 60,
        metaPerDay,
        productionPerDay: production90 / 90,
        // What it costs to remake what sells (units sold × unit cost) — the spend needed to keep stock level
        replenishPerDay: (summary.pl.cogs.product_cost || 0) / elapsed60,
        otherPerDay: other90 / 90,
      },
      monthlyFixed,
      recurring: (recurringRes.data || []).map((r: any) => ({
        description: r.description, type: r.type, amount: Number(r.amount), day: r.day_of_month, start: r.start_month, end: r.end_month,
      })),
    };
    dashboardCache.set('finance_forecast_v1', body, 10 * 60 * 1000);
    return NextResponse.json(body);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not build forecast' }, { status: 500 });
  }
}
