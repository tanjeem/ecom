import { NextRequest, NextResponse } from "next/server";

type WooVariation = {
  id: number;
  price: string;
  regular_price: string;
  attributes: Array<{ name: string; option: string }>;
};

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ variations: [] });

  const base = (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
  const auth = Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
  ).toString("base64");

  if (!base || !process.env.WOOCOMMERCE_CONSUMER_KEY) {
    return NextResponse.json({ variations: [] });
  }

  try {
    const res = await fetch(
      `${base}/wp-json/wc/v3/products/${productId}/variations?per_page=50`,
      { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ variations: [] });

    const raw = (await res.json()) as WooVariation[];
    const variations = Array.isArray(raw)
      ? raw.map((v) => ({
          id: v.id,
          label: v.attributes.map((a) => `${a.name}: ${a.option}`).join(" / ") || `Variation ${v.id}`,
          price: Number(v.price || v.regular_price || 0),
        }))
      : [];

    return NextResponse.json({ variations });
  } catch {
    return NextResponse.json({ variations: [] });
  }
}
