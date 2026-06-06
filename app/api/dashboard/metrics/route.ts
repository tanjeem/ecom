import { NextRequest, NextResponse } from 'next/server';
import { getWooOrders } from '@/lib/integrations/woocommerce';
import { pathaoFetch } from '@/lib/integrations/pathao';
import { fetchMetaCampaignInsights } from '@/lib/integrations/meta';
import type { CommerceOrder } from '@/lib/types/commerce';
import { dashboardCache } from '@/lib/cache';

const FINAL_PATHAO_STATUSES = new Set([
  'Delivered',
  'Partial Delivery',
  'Return',
  'Delivery Failed',
  'Paid Return',
  'Returned to Merchant',
  'Pickup Cancelled',
  'Pickup Failed'
]);

function calcPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function toISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
}

function getDateRange(period: string, customAfter?: string, customBefore?: string) {
  if (period === 'custom' && customAfter) {
    return {
      after: customAfter + 'T00:00:00',
      before: customBefore ? customBefore + 'T23:59:59' : undefined,
      label: customAfter + (customBefore ? ' → ' + customBefore : ''),
      prevAfter: undefined as string | undefined,
      prevBefore: undefined as string | undefined,
    };
  }
  const now = new Date();
  if (period === 'today') {
    const start = new Date(now); start.setHours(0,0,0,0);
    const prev = new Date(now); prev.setDate(prev.getDate()-1); prev.setHours(0,0,0,0);
    const prevEnd = new Date(prev); prevEnd.setHours(23,59,59,0);
    return { after: toISODate(start), before: undefined, label: 'Today', prevAfter: toISODate(prev), prevBefore: prevEnd.toISOString() };
  }
  if (period === 'week') {
    const start = new Date(now); start.setDate(now.getDate()-6); start.setHours(0,0,0,0);
    const prev = new Date(start); prev.setDate(prev.getDate()-7);
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate()-1); prevEnd.setHours(23,59,59,0);
    return { after: toISODate(start), before: undefined, label: 'Last 7 days', prevAfter: toISODate(prev), prevBefore: prevEnd.toISOString() };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { after: toISODate(start), before: undefined, label: 'This month', prevAfter: toISODate(prevStart), prevBefore: prevEnd.toISOString() };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const prevStart = new Date(now.getFullYear()-1, 0, 1);
    const prevEnd = new Date(now.getFullYear()-1, 11, 31, 23, 59, 59);
    return { after: toISODate(start), before: undefined, label: 'This year', prevAfter: toISODate(prevStart), prevBefore: prevEnd.toISOString() };
  }
  return { after: undefined, before: undefined, label: 'All time', prevAfter: undefined, prevBefore: undefined };
}

async function fetchAll(after?: string, before?: string): Promise<CommerceOrder[]> {
  const statuses = ['processing', 'on-hold', 'completed', 'pending'];
  const results = await Promise.allSettled(
    statuses.map((s) => {
      const p = new URLSearchParams({ status: s });
      if (after) p.set('after', after);
      if (before) p.set('before', before);
      // paginate only when we have a date window (bounded query); for open-ended
      // "all time" queries cap at 500 orders per status to stay fast
      return getWooOrders(p, { paginate: Boolean(after), perPage: 100 });
    }),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

/**
 * Batch-fetch live consignment statuses from Pathao for orders that have a consignment ID.
 * Returns a map of consignmentId → live order_status string.
 * Requests are batched in parallel groups of 10 to avoid rate limits.
 */
async function fetchLivePathaoStatuses(orders: CommerceOrder[]): Promise<Map<string, string>> {
  const statusMap = new Map<string, string>();
  
  // Skip fetching live status for orders that already have a final status
  const toFetch = orders.filter((o) => {
    if (!o.pathaoConsignment) return false;
    if (FINAL_PATHAO_STATUSES.has(o.pathaoStatus || '')) {
      statusMap.set(o.pathaoConsignment, o.pathaoStatus || 'Not Booked');
      return false;
    }
    return true;
  });

  if (toFetch.length === 0) return statusMap;

  const BATCH = 10;
  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((o) =>
        pathaoFetch<{ code: number; data: { order_status: string } }>(`/orders/${o.pathaoConsignment}/info`)
      )
    );
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      const id = batch[j].pathaoConsignment!;
      if (r.status === 'fulfilled' && r.value?.data?.order_status) {
        statusMap.set(id, r.value.data.order_status);
      } else {
        // Fall back to cached status from WooCommerce meta
        statusMap.set(id, batch[j].pathaoStatus || 'Not Booked');
      }
    }
  }
  return statusMap;
}

const PATHAO_STATUSES = [
  'Not Booked',
  'Ready',
  'Pickup Requested', 'Assigned for Pickup', 'Pickup', 'Pickup Failed', 'Pickup Cancelled',
  'At the Sorting HUB', 'In Transit', 'Received at Last Mile Hub', 'Assigned for Delivery',
  'Delivered', 'Partial Delivery', 'Return', 'Delivery Failed',
  'On Hold', 'Payment Invoice', 'Paid Return', 'Exchange',
  'Return Id Created', 'Return In Transit', 'Returned to Merchant',
];

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const period = sp.get('period') || 'month';
    const customAfter = sp.get('after') || undefined;
    const customBefore = sp.get('before') || undefined;
    const forceRefresh = sp.get('refresh') === 'true' || sp.get('force') === 'true';

    if (forceRefresh) {
      console.log('[Cache] Force refresh requested, clearing cache.');
      dashboardCache.clear();
    }

    const cacheKey = `dashboard_metrics_${period}_${customAfter || ''}_${customBefore || ''}`;
    if (!forceRefresh) {
      const cached = dashboardCache.get<any>(cacheKey);
      if (cached) {
        console.log(`[Cache] Serving metrics for period "${period}" from cache`);
        return NextResponse.json(cached);
      }
    }

    const { after, before, label, prevAfter, prevBefore } = getDateRange(period, customAfter, customBefore);

    const [current, previous, allOrders, metaAds, invoiceSummaryResult] = await Promise.all([
      fetchAll(after, before),
      prevAfter ? fetchAll(prevAfter, prevBefore) : Promise.resolve([] as CommerceOrder[]),
      // Fetch ALL orders (no date filter) for the "All Orders via webhook" grid only
      fetchAll(),
      fetchMetaCampaignInsights(period, after?.slice(0, 10), before?.slice(0, 10)),
      pathaoFetch<{ data: any }>('/merchant/invoice-summary').catch(() => null),
    ]);

    // Live-fetch Pathao statuses for date-filtered orders (replaces stale ptc_status meta)
    const liveStatusMap = await fetchLivePathaoStatuses(current);

    const totalOrders = current.length;
    const totalValue = current.reduce((s, o) => s + o.total, 0);
    const processingOrders = current.filter((o) => o.status === 'paid').length;
    const holdOrders = current.filter((o) => o.status === 'hold').length;
    const returnedOrders = current.filter((o) => o.status === 'returned' || o.status === 'completed').length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalValue / totalOrders) : 0;

    const pTotalOrders = previous.length;
    const pTotalValue = previous.reduce((s, o) => s + o.total, 0);
    const pProcessing = previous.filter((o) => o.status === 'paid').length;
    const pAvg = pTotalOrders > 0 ? Math.round(pTotalValue / pTotalOrders) : 0;

    // Calculate WooCommerce margins
    const grossMarginValue = current.reduce((sum, o) => {
      const mPct = parseFloat(o.margin?.replace('%', '') || '0');
      return sum + (o.total * (mPct / 100));
    }, 0);
    const avgMarginPct = totalValue > 0 ? Math.round((grossMarginValue / totalValue) * 100) : 0;

    const pGrossMarginValue = previous.reduce((sum, o) => {
      const mPct = parseFloat(o.margin?.replace('%', '') || '0');
      return sum + (o.total * (mPct / 100));
    }, 0);
    const pAvgMarginPct = pTotalValue > 0 ? Math.round((pGrossMarginValue / pTotalValue) * 100) : 0;

    const grossMarginValuePct = calcPct(grossMarginValue, pGrossMarginValue);
    const avgMarginPctPct = calcPct(avgMarginPct, pAvgMarginPct);

    // Sum Meta Ads performance
    const totalAdSpend = metaAds.campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalAdRevenue = metaAds.campaigns.reduce((sum, c) => sum + c.revenue, 0);
    const blendedRoas = totalAdSpend > 0 ? parseFloat((totalAdRevenue / totalAdSpend).toFixed(2)) : 0;

    // Calculate dynamic cash position from Pathao COD
    const invoice = invoiceSummaryResult?.data;
    const pathaoInReview = invoice?.payment_in_review ?? 0;
    const pathaoPreparingInvoice = invoice?.payment_preparing_for_invoice ?? 0;

    const cashAvailable = invoice?.payment_sent ?? 96300; // fallback if not configured
    const cashReceivables = pathaoInReview + pathaoPreparingInvoice;
    const cashProjected = cashAvailable + cashReceivables;

    const buildPathaoGroups = (orders: CommerceOrder[], useLive = false) => {
      const groups: Record<string, { count: number; value: number }> = {};
      for (const order of orders) {
        const ps = useLive && order.pathaoConsignment
          ? (liveStatusMap.get(order.pathaoConsignment) ?? order.pathaoStatus ?? 'Not Booked')
          : (order.pathaoStatus || 'Not Booked');
        if (!groups[ps]) groups[ps] = { count: 0, value: 0 };
        groups[ps].count++;
        groups[ps].value += order.payable || order.total;
      }
      return groups;
    };

    // date-filtered: uses live Pathao statuses
    const currentPathaoGroups = buildPathaoGroups(current, true);
    // all-time: uses cached ptc_status (good enough for the overview grid)
    const allPathaoGroups = buildPathaoGroups(allOrders, false);

    const buildMetrics = (groups: Record<string, { count: number; value: number }>) => {
      const metrics = PATHAO_STATUSES.map((s) => ({
        status: s,
        count: groups[s]?.count ?? 0,
        value: groups[s]?.value ?? 0,
      }));
      for (const [s, v] of Object.entries(groups)) {
        if (!PATHAO_STATUSES.includes(s)) metrics.push({ status: s, count: v.count, value: v.value });
      }
      return metrics;
    };

    const pathaoMetrics = buildMetrics(currentPathaoGroups);
    const allPathaoMetrics = buildMetrics(allPathaoGroups);

    // Daily sales chart data (group by date)
    const dailyMap: Record<string, { orders: number; revenue: number }> = {};
    for (const o of current) {
      const day = (o.dateCreated || '').slice(0, 10);
      if (!day) continue;
      if (!dailyMap[day]) dailyMap[day] = { orders: 0, revenue: 0 };
      dailyMap[day].orders++;
      dailyMap[day].revenue += o.total;
    }
    const dailyChart = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Top products
    const productMap: Record<string, { orders: number; revenue: number }> = {};
    for (const o of current) {
      const prod = o.items || 'Unknown';
      if (!productMap[prod]) productMap[prod] = { orders: 0, revenue: 0 };
      productMap[prod].orders++;
      productMap[prod].revenue += o.total;
    }
    const topProducts = Object.entries(productMap)
      .sort(([,a],[,b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([product, v]) => ({ product, ...v }));

    const responseData = {
      period, label,
      totalOrders, totalOrdersPct: calcPct(totalOrders, pTotalOrders),
      totalValue, totalValuePct: calcPct(totalValue, pTotalValue),
      processingOrders, processingOrdersPct: calcPct(processingOrders, pProcessing),
      holdOrders, returnedOrders,
      avgOrderValue, avgOrderValuePct: calcPct(avgOrderValue, pAvg),
      grossMarginValue, grossMarginValuePct,
      avgMarginPct, avgMarginPctPct,
      totalAdSpend, totalAdRevenue, blendedRoas,
      pathaoMetrics,
      allPathaoMetrics,
      dailyChart,
      topProducts,
      pipelineStages: [
        { name: 'Processing', count: processingOrders },
        { name: 'Packed', count: current.filter((o) => o.status === 'packed').length },
        { name: 'Hold', count: holdOrders },
        { name: 'Dispatched', count: current.filter((o) =>
          ['Delivered','In Transit','Assigned for Delivery','At Delivery Hub'].includes(o.pathaoStatus)).length },
        { name: 'Completed', count: current.filter((o) => o.status === 'completed').length },
      ],
      cashAvailable, cashReceivables, cashProjected,
    };

    // Cache the response metrics for 10 minutes
    dashboardCache.set(cacheKey, responseData, 10 * 60 * 1000);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
