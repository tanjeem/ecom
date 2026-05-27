import { NextRequest, NextResponse } from "next/server";
import { bulkCreatePathaoOrders } from "@/lib/integrations/pathao";
import type { CommerceOrder } from "@/lib/types/commerce";

/**
 * POST /api/pathao/bulk
 * Create multiple orders in bulk using Pathao bulk endpoint
 * More efficient than sequential creation
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      orders: CommerceOrder[];
    };

    if (!payload.orders || !Array.isArray(payload.orders)) {
      return NextResponse.json(
        { error: "orders array is required" },
        { status: 400 }
      );
    }

    if (payload.orders.length === 0) {
      return NextResponse.json(
        { error: "orders array cannot be empty" },
        { status: 400 }
      );
    }

    const result = await bulkCreatePathaoOrders(payload.orders);
    return NextResponse.json({ result }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create bulk Pathao orders" },
      { status: 400 }
    );
  }
}
