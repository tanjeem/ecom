import { NextRequest, NextResponse } from "next/server";
import { createPathaoOrder } from "@/lib/integrations/pathao";
import { updateWooOrderPathaoMeta } from "@/lib/integrations/woocommerce";
import type { CommerceOrder } from "@/lib/types/commerce";
import { dashboardCache } from "@/lib/cache";

type BookResult = { orderId: string; wooId: number; consignmentId: string; status: string; deliveryFee: number };
type BookError  = { orderId: string | undefined; error: string };

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { orders?: CommerceOrder[] };

    if (!payload.orders?.length) {
      return NextResponse.json({ error: "Missing orders array in request body" }, { status: 400 });
    }

    const orders = payload.orders;
    const succeeded: BookResult[] = [];
    const failed: BookError[]     = [];

    const results = await Promise.allSettled(
      orders.map(async (order) => {
        const pathao = await createPathaoOrder(order);
        await updateWooOrderPathaoMeta(order.wooId, pathao.consignmentId, pathao.status, pathao.deliveryFee);
        return { orderId: order.id, wooId: order.wooId, consignmentId: pathao.consignmentId, status: pathao.status, deliveryFee: pathao.deliveryFee };
      }),
    );

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        succeeded.push(r.value);
      } else {
        failed.push({ orderId: orders[i]?.id, error: String(r.reason) });
      }
    });

    if (succeeded.length === 0) {
      return NextResponse.json({ error: failed[0]?.error ?? "All Pathao bookings failed" }, { status: 400 });
    }

    dashboardCache.clear();
    return NextResponse.json({ succeeded, failed }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Pathao order" },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ consignments: [] });
}
