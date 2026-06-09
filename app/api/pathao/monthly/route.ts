import { NextResponse } from 'next/server';
import { getPathaoPortalOrders } from '@/lib/integrations/pathao';

import { dashboardCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const DELIVERED = new Set(['Delivered', 'Partial Delivery']);
const RETURNED  = new Set(['Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit', 'Paid Return']);

export async function GET() {
  const cacheKey = 'pathao_monthly_data';
  const cached = dashboardCache.get<any>(cacheKey);
  if (cached) {
    console.log(`[Cache] Serving pathao monthly from cache`);
    return NextResponse.json(cached);
  }

  try {
    const now = new Date();
    // Fetch all orders without date params (uses 5-min in-memory cache), then
    // bucket in memory — same pattern as the metrics route which correctly returns
    // Jan/Feb data. Passing dates to the portal API filters by a different field
    // and misses older orders.
    const orders = await getPathaoPortalOrders();

    const buckets: Record<string, {
      delivered: number; deliveredCount: number;
      returned: number; returnedCount: number;
    }> = {};

    const startDate = new Date(2025, 0, 1);
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (current <= now) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = { delivered: 0, deliveredCount: 0, returned: 0, returnedCount: 0 };
      current.setMonth(current.getMonth() + 1);
    }

    for (const order of orders) {
      const month = order.order_created_at?.slice(0, 7);
      if (!month || !buckets[month]) continue;
      const amount = order.order_amount || 0;
      if (DELIVERED.has(order.order_status)) {
        buckets[month].delivered += amount;
        buckets[month].deliveredCount++;
      } else if (RETURNED.has(order.order_status)) {
        buckets[month].returned += amount;
        buckets[month].returnedCount++;
      }
    }

    const months = Object.entries(buckets).map(([month, data]) => {
      const d = new Date(month + '-15');
      return {
        month,
        label: d.toLocaleString('default', { month: 'short' }),
        ...data,
      };
    });

    const responseData = { months };
    dashboardCache.set(cacheKey, responseData, 10 * 60 * 1000); // 10 minutes cache
    return NextResponse.json(responseData);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
