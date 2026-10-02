import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dashboardCache } from '@/lib/cache';
import { buildFinanceSummary } from '@/lib/finance/summary';
import { getStockSnapshot } from '@/lib/finance/stock';
import { getCashPosition } from '@/lib/finance/position';
import { budgetForRange } from '@/lib/finance/budget';
import { addDays, daysInMonth, endOf, startOf, todayISO } from '@/lib/finance/periods';
import { getPathaoInvoiceLines, pathaoFetch } from '@/lib/integrations/pathao';
import type { SeriesPoint } from '@/lib/finance/types';

export const dynamic = 'force-dynamic';

export type Alert = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  /** Finance tab (or app view) that explains it */
  tab?: string;
};

const fmt = (n: number) => `৳${Math.round(n).toLocaleString('en-IN')}`;
const sum = (pts: SeriesPoint[], f: (p: SeriesPoint) => number) => pts.reduce((s, p) => s + f(p), 0);

/**
 * Things that need attention, checked against the last 7 days vs the 28
 * before them. Each check is independent; a failing data source just skips
 * its checks.
 */
export async function GET(req: NextRequest) {
  const cached = dashboardCache.get<Alert[]>('finance_alerts_v1');
  if (cached && req.nextUrl.searchParams.get('refresh') !== '1') return NextResponse.json({ alerts: cached });

  const today = todayISO();
  const alerts: Alert[] = [];
  const [sumRes, stockRes, posRes, linesRes, invRes, budgetRes] = await Promise.allSettled([
    buildFinanceSummary({ from: addDays(today, -34), to: today, granularity: 'day' }),
    getStockSnapshot(),
    getCashPosition(),
    getPathaoInvoiceLines(),
    pathaoFetch<any>('/merchant/invoice-summary'),
    supabase.from('fin_budgets').select('id, month, scope, amount'),
  ]);

  if (sumRes.status === 'fulfilled') {
    const s = sumRes.value;
    const days = s.series.filter(p => p.from <= today);
    const last7 = days.slice(-7);
    const prior = days.slice(-35, -7);
    const avg = (pts: SeriesPoint[], f: (p: SeriesPoint) => number) => (pts.length ? sum(pts, f) / pts.length : 0);

    const ads7 = avg(last7, p => p.groups.marketing);
    const adsPrior = avg(prior, p => p.groups.marketing);
    if (adsPrior > 0 && ads7 > adsPrior * 1.4 && ads7 - adsPrior > 500) {
      const rev7 = avg(last7, p => p.revenue);
      const revPrior = avg(prior, p => p.revenue);
      const revUp = revPrior > 0 ? (rev7 / revPrior - 1) * 100 : 0;
      alerts.push({
        id: 'ads-spike', severity: revUp < 20 ? 'warning' : 'info', tab: 'ads',
        title: `Ad spend up ${Math.round((ads7 / adsPrior - 1) * 100)}% this week`,
        detail: `${fmt(ads7)}/day vs ${fmt(adsPrior)}/day before; revenue ${revUp >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(revUp))}%.`,
      });
    }

    const rev7 = avg(last7, p => p.revenue);
    const revPrior = avg(prior, p => p.revenue);
    if (revPrior > 0 && rev7 < revPrior * 0.7) {
      alerts.push({
        id: 'revenue-drop', severity: 'warning', tab: 'overview',
        title: `Revenue down ${Math.round((1 - rev7 / revPrior) * 100)}% this week`,
        detail: `${fmt(rev7)}/day collected vs ${fmt(revPrior)}/day over the previous 4 weeks. Invoices lag deliveries by a few days, so check again before acting.`,
      });
    }

    const ret = (pts: SeriesPoint[]) => { const r = sum(pts, p => p.returned); const d = sum(pts, p => p.delivered); return r + d >= 8 ? (r / (r + d)) * 100 : null; };
    const r7 = ret(last7);
    const rPrior = ret(prior);
    if (r7 != null && r7 >= 25 && (rPrior == null || r7 > rPrior + 5)) {
      alerts.push({
        id: 'returns-up', severity: r7 >= 35 ? 'critical' : 'warning', tab: 'returns',
        title: `Return rate ${Math.round(r7)}% this week`,
        detail: rPrior != null ? `Up from ${Math.round(rPrior)}% over the previous 4 weeks. Each return costs the courier fee with no sale.` : 'Each return costs the courier fee with no sale.',
      });
    }

    const last30 = days.slice(-30);
    const rev30 = sum(last30, p => p.revenue);
    const net30 = sum(last30, p => p.net);
    if (rev30 > 0 && net30 < 0) {
      alerts.push({ id: 'net-loss-30', severity: 'critical', tab: 'reports', title: 'Losing money over the last 30 days', detail: `Net ${fmt(net30)} on ${fmt(rev30)} revenue.` });
    } else if (rev30 > 0 && (net30 / rev30) * 100 < 10) {
      alerts.push({ id: 'thin-margin-30', severity: 'warning', tab: 'reports', title: `Net margin only ${Math.round((net30 / rev30) * 100)}% (30 days)`, detail: `Net ${fmt(net30)} on ${fmt(rev30)} revenue.` });
    }

    // Budgets: this month at the current pace
    if (budgetRes.status === 'fulfilled' && budgetRes.value.data?.length) {
      const mFrom = startOf(today, 'month');
      const mTo = endOf(today, 'month');
      const elapsed = Number(today.slice(8, 10));
      if (elapsed >= 5) {
        const pace = daysInMonth(today) / elapsed;
        const month = days.filter(p => p.from >= mFrom);
        for (const g of ['marketing', 'production', 'overhead', 'logistics', 'other'] as const) {
          const b = budgetForRange(budgetRes.value.data as any, { from: mFrom, to: mTo }, g);
          const actual = sum(month, p => p.groups[g]);
          if (b && actual * pace > b * 1.05) {
            alerts.push({ id: `budget-${g}`, severity: actual > b ? 'critical' : 'warning', tab: 'overview', title: `${g[0].toUpperCase()}${g.slice(1)} heading over budget`, detail: `${fmt(actual)} spent so far; on pace for ${fmt(actual * pace)} vs ${fmt(b)} budget.` });
          }
        }
      }
    }
  }

  // Pathao payouts: money held but nothing paid for a while
  if (linesRes.status === 'fulfilled' && invRes.status === 'fulfilled') {
    const d = invRes.value?.data;
    const held = d ? (Number(d.payment_in_review) || 0) + (Number(d.payment_preparing_for_invoice) || 0) + (Number(d.payment_in_process) || 0) : 0;
    const lastPaid = linesRes.value.reduce((m, l) => (l.paid_date && l.paid_date > m ? l.paid_date : m), '');
    if (held > 0 && lastPaid && lastPaid < addDays(today, -4)) {
      alerts.push({ id: `pathao-late-${lastPaid}`, severity: 'warning', tab: 'cash', title: 'No Pathao payout in 4+ days', detail: `Last payout ${lastPaid}; Pathao is holding ${fmt(held)}.` });
    }
  }

  if (stockRes.status === 'fulfilled') {
    const st = stockRes.value;
    const runningOut = st.products.filter(p => p.sold30 >= 5 && p.coverDays != null && p.coverDays < 14);
    if (runningOut.length) {
      alerts.push({
        id: `stock-low-${runningOut.map(p => p.id).join('-')}`, severity: 'warning', tab: 'products',
        title: `${runningOut.length} best-seller${runningOut.length > 1 ? 's' : ''} running out`,
        detail: runningOut.slice(0, 3).map(p => `${p.name} (${p.stock} left, ~${Math.round(p.coverDays!)} days)`).join(', ') + (runningOut.length > 3 ? '…' : ''),
      });
    }
    // Fashion sells by size: a sold-out size on a moving product loses sales even when the product looks stocked
    const soldOutSizes = st.products.flatMap(p => p.variants.filter(v => v.stock === 0 && v.sold30 >= 2).map(v => `${p.name} ${v.size}`));
    if (soldOutSizes.length) {
      alerts.push({
        id: `sizes-out-${soldOutSizes.length}`, severity: 'warning', tab: 'products',
        title: `${soldOutSizes.length} selling size${soldOutSizes.length > 1 ? 's' : ''} sold out`,
        detail: soldOutSizes.slice(0, 4).join(', ') + (soldOutSizes.length > 4 ? '…' : ''),
      });
    }
    if (st.totals.deadValue > 20000) {
      alerts.push({ id: 'dead-stock', severity: 'info', tab: 'products', title: `${fmt(st.totals.deadValue)} of stock hasn’t sold in 90 days`, detail: `${st.totals.deadUnits} units. Consider a bundle, discount or restyle.` });
    }
  }

  if (posRes.status === 'fulfilled') {
    const p = posRes.value;
    if (p.runwayMonths != null && p.runwayMonths < 3) {
      alerts.push({ id: 'runway', severity: p.runwayMonths < 1.5 ? 'critical' : 'warning', tab: 'cash', title: `About ${p.runwayMonths.toFixed(1)} months of cash left`, detail: `Burning ${fmt(-p.monthlyNet)}/month on average (90 days).` });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  dashboardCache.set('finance_alerts_v1', alerts, 10 * 60 * 1000);
  return NextResponse.json({ alerts });
}
