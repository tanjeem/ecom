import { NextRequest, NextResponse } from "next/server";
import type { OrderStatus } from "@/lib/types/commerce";
import { dashboardCache } from "@/lib/cache";

function getWooBaseURL() {
  return (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
}

function wooAuth() {
  return Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
  ).toString("base64");
}

const STATUS_TO_WOO: Record<OrderStatus, string> = {
  paid: "processing",
  packed: "processing", // "packed" is stored in meta, WooCommerce status stays processing
  hold: "on-hold",
  returned: "refunded",
  completed: "completed",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const wooId = id.replace(/^#/, ""); // strip leading # if present

  let newStatus: OrderStatus;
  try {
    const body = await request.json() as { status: OrderStatus };
    newStatus = body.status;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validStatuses: OrderStatus[] = ["paid", "packed", "hold", "returned", "completed"];
  if (!validStatuses.includes(newStatus)) {
    return NextResponse.json({ error: `Invalid status: ${newStatus}` }, { status: 400 });
  }

  const wooStatus = STATUS_TO_WOO[newStatus];

  // For "packed" we store the status in meta and leave WooCommerce status as processing
  // For all others we clear the meta and update WooCommerce status directly
  const metaData = newStatus === "packed"
    ? [{ key: "_threadops_status", value: "packed" }]
    : [{ key: "_threadops_status", value: "" }];

  try {
    const res = await fetch(`${getWooBaseURL()}/wp-json/wc/v3/orders/${wooId}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${wooAuth()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status: wooStatus, meta_data: metaData }),
      cache: "no-store",
    });

    const data = await res.json() as { id?: number; status?: string; message?: string };

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || `WooCommerce error ${res.status}` },
        { status: res.status },
      );
    }

    dashboardCache.clear();
    return NextResponse.json({ id: wooId, status: newStatus, wooStatus: data.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    );
  }
}
