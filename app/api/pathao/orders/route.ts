import { NextRequest, NextResponse } from "next/server";
import { createPathaoOrder, bulkCreatePathaoOrders } from "@/lib/integrations/pathao";
import type { CommerceOrder } from "@/lib/types/commerce";

/**
 * POST /api/pathao/orders
 * Create single or bulk Pathao orders
 * Body: { order?: CommerceOrder } | { orders?: CommerceOrder[] } | { orderIds?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      order?: CommerceOrder;
      orders?: CommerceOrder[];
      orderIds?: string[];
    };

    // Single order creation
    if (payload.order) {
      const pathao = await createPathaoOrder(payload.order);
      return NextResponse.json({ pathao }, { status: 201 });
    }

    // Bulk order creation from array
    if (payload.orders && Array.isArray(payload.orders)) {
      const result = await bulkCreatePathaoOrders(payload.orders);
      return NextResponse.json({ result }, { status: 201 });
    }

    return NextResponse.json(
      { error: "Missing order or orders in request body" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Pathao order" },
      { status: 400 }
    );
  }
}

export async function GET(_request: NextRequest) {
  // Pathao does not have a list-all consignments endpoint
  return NextResponse.json({ consignments: [] });
}
