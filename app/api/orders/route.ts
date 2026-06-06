import { NextRequest, NextResponse } from "next/server";
import { getWooOrdersPage, updateWooOrderStatus } from "@/lib/integrations/woocommerce";
import type { CommerceOrder } from "@/lib/types/commerce";

const DEFAULT_PER_PAGE = 50;

const PATHAO_DELIVERED = new Set(['Delivered', 'Partial Delivery']);
const PATHAO_RETURNED  = new Set(['Return', 'Paid Return', 'Returned to Merchant', 'Return Id Created']);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page    = Math.max(1, Number(sp.get("page")    || 1));
  const perPage = Math.max(1, Number(sp.get("perPage") || DEFAULT_PER_PAGE));
  const status  = sp.get("status") || undefined;

  try {
    const { orders, total, totalPages } = await getWooOrdersPage(page, perPage, status);

    // Auto-sync WooCommerce status from cached Pathao status (fire and forget)
    const toComplete = orders.filter(
      (o: CommerceOrder) => PATHAO_DELIVERED.has(o.pathaoStatus) && o.status !== "completed",
    );
    const toFail = orders.filter(
      (o: CommerceOrder) => PATHAO_RETURNED.has(o.pathaoStatus) && o.status !== "returned",
    );

    if (toComplete.length > 0 || toFail.length > 0) {
      Promise.all([
        ...toComplete.map((o: CommerceOrder) => updateWooOrderStatus(o.wooId, "completed")),
        ...toFail.map((o: CommerceOrder)     => updateWooOrderStatus(o.wooId, "failed")),
      ]).catch((e) => console.warn("Auto-sync Pathao→WooCommerce:", e));
    }

    return NextResponse.json({ orders, total, page, totalPages });
  } catch (error) {
    console.error("Orders API error:", error);
    return NextResponse.json({ orders: [], total: 0, page, totalPages: 1 }, { status: 500 });
  }
}
