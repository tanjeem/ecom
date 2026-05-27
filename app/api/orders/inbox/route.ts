import { NextRequest, NextResponse } from "next/server";
import { createInboxWooOrder } from "@/lib/integrations/woocommerce";
import type { InboxOrderInput } from "@/lib/types/commerce";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as InboxOrderInput;
    const order = await createInboxWooOrder(payload);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create WooCommerce order" },
      { status: 400 },
    );
  }
}
