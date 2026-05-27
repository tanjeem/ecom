import { NextRequest, NextResponse } from 'next/server';
import { getWooOrders } from '@/lib/integrations/woocommerce';
import type { CommerceOrder } from '@/lib/types/commerce';

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
      return getWooOrders(p); // getWooOrders now paginates internally
    }),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
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

    const { after, before, label, prevAfter, prevBefore } = getDateRange(period, customAfter, customBefore);

    const [current, previous, allOrders] = await Promise.all([
      fetchAll(after, before),
      prevAfter ? fetchAll(prevAfter, prevBefore) : Promise.resolve([] as CommerceOrder[]),
      // Fetch ALL orders (no date filter) for Pathao status breakdown — ptc_status reflects current state regardless of order date
      (after || before) ? fetchAll(undefined, undefined) : Promise.resolve([] as CommerceOrder[]),
    ]);

    const totalOrders = current.length;
    const totalValue = current.reduce((s, o) => s + o.total, 0);
    const processingOrders = current.filter((o) => o.status === 'paid').length;
    const holdOrders = current.filter((o) => o.status === 'hold').length;
    const returnedOrders = current.filter((o) => o.status === 'returned').length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalValue / totalOrders) : 0;

    const pTotalOrders = previous.length;
    const pTotalValue = previous.reduce((s, o) => s + o.total, 0);
    const pProcessing = previous.filter((o) => o.status === 'paid').length;
    const pAvg = pTotalOrders > 0 ? Math.round(pTotalValue / pTotalOrders) : 0;

    // Pathao breakdown — use all orders (no date filter) so we see real delivery statuses
    // ptc_status is the current courier state, not tied to order creation date
    const pathaoSource = allOrders.length > 0 ? allOrders : current;
    const pathaoGroups: Record<string, { count: number; value: number }> = {};
    for (const order of pathaoSource) {
      const ps = order.pathaoStatus || 'Unknown';
      if (!pathaoGroups[ps]) pathaoGroups[ps] = { count: 0, value: 0 };
      pathaoGroups[ps].count++;
      pathaoGroups[ps].value += order.payable || order.total;
    }
    const pathaoMetrics = PATHAO_STATUSES.map((s) => ({
      status: s,
      count: pathaoGroups[s]?.count ?? 0,
      value: pathaoGroups[s]?.value ?? 0,
    }));
    // append any unknown statuses
    for (const [s, v] of Object.entries(pathaoGroups)) {
      if (!PATHAO_STATUSES.includes(s)) pathaoMetrics.push({ status: s, count: v.count, value: v.value });
    }

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

    return NextResponse.json({
      period, label,
      totalOrders, totalOrdersPct: calcPct(totalOrders, pTotalOrders),
      totalValue, totalValuePct: calcPct(totalValue, pTotalValue),
      processingOrders, processingOrdersPct: calcPct(processingOrders, pProcessing),
      holdOrders, returnedOrders,
      avgOrderValue, avgOrderValuePct: calcPct(avgOrderValue, pAvg),
      pathaoMetrics,
      dailyChart,
      topProducts,
      pipelineStages: [
        { name: 'Paid', count: processingOrders },
        { name: 'Packed', count: current.filter((o) => o.status === 'packed').length },
        { name: 'Hold', count: holdOrders },
        { name: 'Dispatched', count: current.filter((o) =>
          ['Delivered','In Transit','Assigned for Delivery','At Delivery Hub'].includes(o.pathaoStatus)).length },
      ],
      cashAvailable: 96300, cashObligations: 37940, cashSurplus: 58360,
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
