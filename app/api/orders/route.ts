import { NextRequest, NextResponse, after } from "next/server";
import { getWooOrdersPage, getWooStatusTotals } from "@/lib/integrations/woocommerce";
import { syncIfStale } from "@/lib/orders/pathaoSync";
import type { OrderStatus } from "@/lib/types/commerce";
import { ORDER_STATUSES, STATUS_WOO_SLUGS, isOrderStatus } from "@/lib/orderStatus";
import { dashboardCache } from "@/lib/cache";

export const maxDuration = 60;

const DEFAULT_PER_PAGE = 50;
const COUNTS_TTL = 60 * 1000;

/** Store-wide order count per app status, cached briefly. Null if WooCommerce's report fails. */
async function getStatusCounts(): Promise<Record<OrderStatus | "all", number> | null> {
  const cached = dashboardCache.get<Record<OrderStatus | "all", number>>("orders_status_counts");
  if (cached) return cached;
  try {
    const totals = await getWooStatusTotals();
    const counts = { all: 0 } as Record<OrderStatus | "all", number>;
    for (const status of ORDER_STATUSES) {
      counts[status] = STATUS_WOO_SLUGS[status].reduce((sum, slug) => sum + (totals[slug] ?? 0), 0);
      counts.all += counts[status];
    }
    dashboardCache.set("orders_status_counts", counts, COUNTS_TTL);
    return counts;
  } catch (error) {
    console.warn("Order status totals unavailable:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page    = Math.max(1, Number(sp.get("page")    || 1));
  const perPage = Math.max(1, Number(sp.get("perPage") || DEFAULT_PER_PAGE));
  // `status` is an app status (paid, packed, …); filter WooCommerce by every slug it covers
  const statusParam = sp.get("status") || "";
  const status  = isOrderStatus(statusParam) ? STATUS_WOO_SLUGS[statusParam].join(",") : undefined;
  const search  = sp.get("search")?.trim() || undefined;

  try {
    const [{ orders, total, totalPages }, counts] = await Promise.all([
      getWooOrdersPage(page, perPage, status, search),
      getStatusCounts(),
    ]);

    // Bring orders up to date with Pathao after responding (at most every 10 minutes)
    after(() => syncIfStale());

    return NextResponse.json({ orders, total, page, totalPages, counts });
  } catch (error) {
    console.error("Orders API error:", error);
    return NextResponse.json({ orders: [], total: 0, page, totalPages: 1 }, { status: 500 });
  }
}
