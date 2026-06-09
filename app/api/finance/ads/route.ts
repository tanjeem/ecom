import { NextResponse } from 'next/server';
import { fetchMetaMonthlyInsights } from '@/lib/integrations/meta';
import { getPathaoPortalOrders } from '@/lib/integrations/pathao';
import { supabase } from '@/lib/supabase';
import { dashboardCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bypassCache = searchParams.get('refresh') === 'true';
  const cacheKey = 'meta_reconciliation_monthly_data';

  if (!bypassCache) {
    const cached = dashboardCache.get<any>(cacheKey);
    if (cached) {
      console.log(`[Cache] Serving meta reconciliation monthly from cache`);
      return NextResponse.json(cached);
    }
  } else {
    console.log(`[Cache] Bypassing cache for meta reconciliation monthly`);
  }

  try {
    // 1. Fetch Meta insights
    const metaData = await fetchMetaMonthlyInsights();

    // 2. Fetch Supabase store revenue transactions
    const { data: transactions, error: txError } = await supabase
      .from('fin_transactions')
      .select('date, amount, category, type')
      .eq('type', 'income');

    if (txError) {
      throw new Error(`Failed to fetch transactions from Supabase: ${txError.message}`);
    }

    const storeRevenueBuckets: Record<string, number> = {};
    if (transactions) {
      for (const tx of transactions) {
        const month = tx.date?.slice(0, 7); // YYYY-MM
        if (!month) continue;
        if (tx.category === 'sales_prepaid' || tx.category === 'sales_cod') {
          if (!storeRevenueBuckets[month]) {
            storeRevenueBuckets[month] = 0;
          }
          storeRevenueBuckets[month] += Number(tx.amount) || 0;
        }
      }
    }

    // 3. Fetch Pathao orders and bucket counts
    const pathaoOrders = await getPathaoPortalOrders().catch((err) => {
      console.error('[API] Failed to fetch Pathao orders:', err);
      return [];
    });

    const DELIVERED = new Set(['Delivered', 'Partial Delivery']);
    const RETURNED  = new Set(['Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit', 'Paid Return']);

    const pathaoBuckets: Record<string, { deliveredCount: number; returnedCount: number; deliveredAmount: number }> = {};
    for (const order of pathaoOrders) {
      const month = order.order_created_at?.slice(0, 7);
      if (!month) continue;
      if (!pathaoBuckets[month]) {
        pathaoBuckets[month] = { deliveredCount: 0, returnedCount: 0, deliveredAmount: 0 };
      }
      const amount = order.order_amount || 0;
      if (DELIVERED.has(order.order_status)) {
        pathaoBuckets[month].deliveredCount++;
        pathaoBuckets[month].deliveredAmount += amount;
      } else if (RETURNED.has(order.order_status)) {
        pathaoBuckets[month].returnedCount++;
      }
    }

    // 4. Merge all sources using the month key
    const reconciledData = metaData.map((item) => {
      const month = item.month;
      const pathao = pathaoBuckets[month] || { deliveredCount: 0, returnedCount: 0, deliveredAmount: 0 };
      const storeRevenue = storeRevenueBuckets[month] || 0;

      return {
        ...item,
        storeRevenue,
        deliveredOrders: pathao.deliveredCount,
        returnedOrders: pathao.returnedCount,
        deliveredAmount: pathao.deliveredAmount,
      };
    });

    dashboardCache.set(cacheKey, reconciledData, 10 * 60 * 1000); // 10 minutes cache
    return NextResponse.json(reconciledData);
  } catch (error: any) {
    console.error('API /api/finance/ads error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
