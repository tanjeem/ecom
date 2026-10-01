// Builds the finance summary for any date range: P&L, a bucketed time series,
// order stats, cash flow and top spenders. Every finance view reads from this
// so the numbers agree everywhere.
//
// Accounting rules:
// - Pathao revenue follows paid invoices only: cash collected on each invoiced
//   delivery, dated by the invoice. Pathao's invoiced fees are the courier
//   cost, so revenue − fees equals the payouts exactly. Ledger `pathao_payout`
//   rows are ignored (the invoices are the record of that cash). Prepaid /
//   direct / other income still comes from the ledger.
// - Meta ad spend comes from the Meta API (daily, USD → BDT incl. VAT) and
//   replaces manually logged `ads_meta` rows when available.
// - Fixed costs accrue daily (monthly amount ÷ days in month) up to today, so
//   any window — a week, a partial month — carries its fair share.
// - Live Pathao orders are used only for the "in progress" count.

import { supabase } from '@/lib/supabase';
import { getPathaoInvoiceLines, getPathaoPortalOrders, pathaoFetch, type PathaoPortalOrder } from '@/lib/integrations/pathao';
import { fetchMetaDailySpend } from '@/lib/integrations/meta';
import { dashboardCache } from '@/lib/cache';
import { COGS_CATEGORIES, ALL_CATEGORIES } from '@/lib/types/finance';
import {
  addDays, bucketKeyFor, bucketsInRange, daysBetween, daysInMonth, minISO, todayISO, type Granularity,
} from './periods';
import { metaUsdToBdt, type FinanceSummary, type SeriesPoint } from './types';
import { CAT_TO_GROUP, emptyGroups, plFromCats } from './pl';

// Live order statuses that are finished (or dead) — everything else is still in progress
const CLOSED = new Set([
  'Delivered', 'Partial Delivery', 'Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit',
  'Paid Return', 'Pickup Cancel', 'Pickup Cancelled', 'Cancelled', 'Payment Invoice',
]);

const TRANSFER_IN = new Set(['owner_investment', 'loan_received']);

type TxRow = {
  id: string; date: string; type: string; category: string; amount: number; description: string;
  payment_method: string | null; vendor_name: string | null;
};

/** Supabase caps a select at 1000 rows — page through so long ranges stay complete. */
async function fetchTransactions(from: string, to: string): Promise<TxRow[]> {
  const PAGE = 1000;
  const rows: TxRow[] = [];
  for (let offset = 0; offset < 100_000; offset += PAGE) {
    const { data, error } = await supabase
      .from('fin_transactions')
      .select('id, date, type, category, amount, description, payment_method, fin_vendors(name)')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('id')
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const t of data || []) {
      rows.push({
        id: t.id, date: t.date, type: t.type, category: t.category, amount: Number(t.amount) || 0, description: t.description,
        payment_method: t.payment_method, vendor_name: (t as any).fin_vendors?.name ?? null,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function metaDailyCached(from: string, to: string) {
  const key = `meta_daily_spend_${from}_${to}`;
  const cached = dashboardCache.get<Record<string, number> | null>(key);
  if (cached !== undefined && cached !== null) return cached;
  const daily = await fetchMetaDailySpend(from, to);
  if (daily) dashboardCache.set(key, daily, 30 * 60 * 1000);
  return daily;
}

const OPEX_KEYS = new Set(['rent', 'salary', 'transport', 'ads_meta', 'ads_google', 'photoshoot', 'miscellaneous']);

export async function buildFinanceSummary(opts: {
  from: string; to: string; granularity: Granularity; includeInvoice?: boolean;
}): Promise<FinanceSummary> {
  const { from, to, granularity } = opts;
  const today = todayISO();
  const accrueTo = minISO(to, today); // never accrue fixed costs or fetch ads for the future
  const hasPast = from <= accrueTo;
  const warnings: string[] = [];

  const [txRes, fixedRes, overridesRes, pathaoRes, metaRes, invoiceRes, linesRes] = await Promise.allSettled([
    fetchTransactions(from, to),
    supabase.from('fin_fixed_costs').select('id, category, default_amount'),
    supabase.from('fin_fixed_cost_months').select('fixed_cost_id, month, amount').gte('month', from.slice(0, 7)).lte('month', to.slice(0, 7)),
    getPathaoPortalOrders(),
    hasPast ? metaDailyCached(from, accrueTo) : Promise.resolve(null),
    opts.includeInvoice ? pathaoFetch<any>('/merchant/invoice-summary') : Promise.resolve(null),
    getPathaoInvoiceLines(),
  ]);

  if (txRes.status === 'rejected') throw new Error(`Could not load transactions: ${txRes.reason?.message || txRes.reason}`);
  const txs = txRes.value;

  const invoiceLines = linesRes.status === 'fulfilled' ? linesRes.value : [];
  const pathaoOk = invoiceLines.length > 0;
  if (!pathaoOk) warnings.push('Pathao invoices unavailable — run scripts/sync-pathao-invoices.mjs.');
  const metaDaily = metaRes.status === 'fulfilled' ? metaRes.value : null;
  const metaSource: 'api' | 'ledger' = metaDaily ? 'api' : 'ledger';

  // ── buckets ──
  const buckets = bucketsInRange(from, to, granularity);
  const byKey = new Map<string, SeriesPoint>();
  const series: SeriesPoint[] = buckets.map(b => {
    const p: SeriesPoint = {
      ...b, revenue: 0, expenses: 0, gross: 0, net: 0, delivered: 0, returned: 0, groups: emptyGroups(), cats: {},
    };
    byKey.set(b.key, p);
    return p;
  });
  const totalCats: Record<string, number> = {};
  const add = (date: string, cat: string, amount: number) => {
    if (!amount) return;
    totalCats[cat] = (totalCats[cat] || 0) + amount;
    const p = byKey.get(bucketKeyFor(date, granularity));
    if (p) p.cats[cat] = (p.cats[cat] || 0) + amount;
  };

  // ── ledger ──
  const cash = { inflow: 0, outflow: 0, net: 0, byMethod: [] as { method: string; inflow: number; outflow: number }[], transfers: {} as Record<string, number>, pathaoPayouts: 0 };
  const methods = new Map<string, { inflow: number; outflow: number }>();
  const catCounts: Record<string, number> = {};
  // Manual income rows that look like Pathao COD, by month — checked against live Pathao data below
  const manualPathao: Record<string, number> = {};
  const vendors = new Map<string, { amount: number; count: number }>();

  for (const t of txs) {
    const isIn = t.type === 'income' || (t.type === 'transfer' && TRANSFER_IN.has(t.category));
    const m = methods.get(t.payment_method || 'Other') || { inflow: 0, outflow: 0 };
    if (isIn) { cash.inflow += t.amount; m.inflow += t.amount; } else { cash.outflow += t.amount; m.outflow += t.amount; }
    methods.set(t.payment_method || 'Other', m);

    if (t.type === 'transfer') {
      cash.transfers[t.category] = (cash.transfers[t.category] || 0) + t.amount;
      continue;
    }
    if (t.type === 'income') {
      if (t.category === 'pathao_payout') {
        // Invoices are the record of Pathao cash; keep logged payouts out of the totals
        cash.inflow -= t.amount; m.inflow -= t.amount;
      } else {
        add(t.date, t.category, t.amount);
        if (/pathao/i.test(t.description || '')) {
          const m = t.date.slice(0, 7);
          manualPathao[m] = (manualPathao[m] || 0) + t.amount;
        }
      }
      continue;
    }
    // expense
    if (t.category === 'ads_meta' && metaSource === 'api') continue; // API is authoritative
    const cat = COGS_CATEGORIES.includes(t.category) || OPEX_KEYS.has(t.category) ? t.category : 'miscellaneous';
    add(t.date, cat, t.amount);
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    if (t.vendor_name) {
      const v = vendors.get(t.vendor_name) || { amount: 0, count: 0 };
      v.amount += t.amount; v.count++;
      vendors.set(t.vendor_name, v);
    }
  }
  // ── Meta ad spend ──
  if (metaDaily) {
    for (const [date, usd] of Object.entries(metaDaily)) {
      if (date >= from && date <= accrueTo) add(date, 'ads_meta', metaUsdToBdt(usd));
    }
  }

  // ── fixed costs, accrued daily ──
  const fixedCosts = fixedRes.status === 'fulfilled' ? fixedRes.value.data || [] : [];
  const overrides = overridesRes.status === 'fulfilled' ? overridesRes.value.data || [] : [];
  if (fixedRes.status === 'fulfilled' && fixedRes.value.error) warnings.push('Fixed costs could not be loaded.');
  const overrideMap = new Map(overrides.map((o: any) => [`${o.fixed_cost_id}|${o.month}`, Number(o.amount)]));
  if (hasPast && fixedCosts.length) {
    for (let d = from; d <= accrueTo; d = addDays(d, 1)) {
      const month = d.slice(0, 7);
      const dim = daysInMonth(d);
      for (const fc of fixedCosts as any[]) {
        const ov = overrideMap.get(`${fc.id}|${month}`);
        const monthly = ov ?? Number(fc.default_amount);
        if (!monthly) continue;
        const cat = OPEX_KEYS.has(fc.category) ? fc.category : 'miscellaneous';
        add(d, cat, monthly / dim);
      }
    }
  }

  // ── Pathao, from paid invoices ──
  const orders = {
    delivered: { count: 0, amount: 0 }, returned: { count: 0, amount: 0 }, inProcess: { count: 0, amount: 0 },
    courierFees: 0, aov: 0, returnRate: 0,
  };
  const invoiceByMonth: Record<string, number> = {};
  const payoutMethod = methods.get('Pathao payout') || { inflow: 0, outflow: 0 };
  for (const l of invoiceLines) {
    // Cash actually paid out in the range, by payout date
    if (l.paid_date && l.paid_date >= from && l.paid_date <= to) {
      cash.pathaoPayouts += l.payout;
      cash.inflow += l.payout;
      payoutMethod.inflow += l.payout;
    }
    const date = l.invoice_date;
    if (date < from || date > to) continue;
    const p = byKey.get(bucketKeyFor(date, granularity));
    add(date, 'courier_fees', l.fee);
    if (l.type === 'delivery') {
      orders.delivered.count++; orders.delivered.amount += l.collected;
      add(date, 'pathao_cod', l.collected);
      invoiceByMonth[date.slice(0, 7)] = (invoiceByMonth[date.slice(0, 7)] || 0) + l.collected;
      if (p) p.delivered++;
    } else {
      orders.returned.count++;
      if (p) p.returned++;
    }
  }
  if (payoutMethod.inflow) methods.set('Pathao payout', payoutMethod);
  orders.courierFees = totalCats.courier_fees || 0;
  orders.aov = orders.delivered.count ? orders.delivered.amount / orders.delivered.count : 0;
  const closed = orders.delivered.count + orders.returned.count;
  orders.returnRate = closed ? (orders.returned.count / closed) * 100 : 0;

  // Orders not yet invoiced — live data, by order date
  if (pathaoRes.status === 'fulfilled') {
    for (const o of pathaoRes.value as PathaoPortalOrder[]) {
      const date = o.order_created_at?.slice(0, 10);
      if (!date || date < from || date > to || CLOSED.has(o.order_status)) continue;
      orders.inProcess.count++;
      orders.inProcess.amount += Number(o.order_amount) || 0;
    }
  }

  // Flag likely double counting: Pathao COD logged by hand in a month the invoices already cover
  const overlaps = Object.entries(manualPathao).filter(([m]) => (invoiceByMonth[m] || 0) > 0);
  if (overlaps.length) {
    const total = overlaps.reduce((s, [, v]) => s + v, 0);
    const months = overlaps.map(([m]) => new Date(`${m}-15T00:00:00`).toLocaleString('en-GB', { month: 'short', year: 'numeric' })).join(', ');
    warnings.push(`Possible double count: ৳${Math.round(total).toLocaleString('en-IN')} of income mentioning "Pathao" was logged manually for ${months}, but Pathao invoices already supply COD revenue for ${overlaps.length > 1 ? 'those months' : 'that month'}.`);
  }

  cash.net = cash.inflow - cash.outflow;
  cash.byMethod = [...methods.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .filter(m => m.inflow || m.outflow)
    .sort((a, b) => (b.inflow + b.outflow) - (a.inflow + a.outflow));

  // ── roll up ──
  for (const p of series) {
    const pl = plFromCats(p.cats);
    p.revenue = pl.revenue.total;
    p.expenses = pl.expenses;
    p.gross = pl.gross_profit;
    p.net = pl.net_profit;
    p.groups = pl.groups;
  }

  const costCats = Object.keys(totalCats).filter(c => CAT_TO_GROUP[c]);
  const topCategories = costCats
    .map(category => ({ category, amount: totalCats[category], count: catCounts[category] || 0 }))
    .sort((a, b) => b.amount - a.amount);

  const topVendors = [...vendors.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  let invoice = null;
  if (invoiceRes.status === 'fulfilled' && invoiceRes.value?.data) {
    const d = invoiceRes.value.data;
    invoice = {
      lastInvoiceDate: d.last_invoice_date ?? null,
      paymentSent: Number(d.payment_sent) || 0,
      lifetimeEarning: Number(d.lifetime_earning) || 0,
      inTransit: (Number(d.payment_in_process) || 0) + (Number(d.payment_in_review) || 0) + (Number(d.payment_preparing_for_invoice) || 0),
    };
  }

  return {
    range: { from, to, days: daysBetween(from, to), elapsedDays: hasPast ? daysBetween(from, accrueTo) : 0 },
    granularity,
    pl: plFromCats(totalCats),
    series,
    orders,
    cash,
    topCategories,
    topVendors,
    txCount: txs.length,
    invoice,
    sources: { meta: metaSource, pathao: pathaoOk, fixedCosts: fixedCosts.length },
    warnings,
  };
}

export const categoryLabel = (cat: string) =>
  cat === 'pathao_cod' ? 'Pathao COD (invoiced)' : cat === 'courier_fees' ? 'Pathao fees' : ALL_CATEGORIES[cat] || cat;
