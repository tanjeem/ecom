import { NextResponse } from 'next/server';
import { fetchMetaMonthlyInsights } from '@/lib/integrations/meta';
import { buildFinanceSummary } from '@/lib/finance/summary';
import { todayISO } from '@/lib/finance/periods';
import { dashboardCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bypassCache = searchParams.get('refresh') === 'true';
  const cacheKey = 'meta_reconciliation_monthly_data_v3';

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

    // 2. Revenue, Pathao fees, product cost and order counts per month from the
    //    shared finance summary, so this tab agrees with Overview and P&L
    //    (invoice-based Pathao revenue, customer returns counted once).
    const firstMonth = metaData[0]?.month || '2025-01';
    const summary = await buildFinanceSummary({ from: `${firstMonth}-01`, to: todayISO(), granularity: 'month' });
    const byMonth = new Map(summary.series.map(p => [p.key.slice(0, 7), p]));

    // 3. Merge using the month key
    const reconciledData = metaData.map((item) => {
      const p = byMonth.get(item.month);
      const c = p?.cats || {};
      return {
        ...item,
        storeRevenue: 0, // revenue is Pathao collected only (deliveredAmount)
        deliveredOrders: p?.delivered || 0,
        returnedOrders: p?.returned || 0,
        deliveredAmount: c.pathao_cod || 0,
        pathaoFees: c.courier_fees || 0,
        productCost: summary.cogs.method === 'per_unit' ? (c.product_cost || 0) : null,
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
