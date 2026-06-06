import { NextRequest, NextResponse } from "next/server";

type WooProduct = {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  type: string;
  status: string;
  variations?: number[];
};

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ products: [] });

  const base = (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
  const auth = Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
  ).toString("base64");

  if (!base || !process.env.WOOCOMMERCE_CONSUMER_KEY) {
    return NextResponse.json({ products: [] });
  }

  try {
    const params = new URLSearchParams({ search: q, per_page: "10", status: "publish" });
    const res = await fetch(`${base}/wp-json/wc/v3/products?${params}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ products: [] });

    const raw = (await res.json()) as WooProduct[];
    const products = Array.isArray(raw)
      ? raw.map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price || p.regular_price || 0),
          type: p.type,
          hasVariations: (p.variations?.length ?? 0) > 0,
        }))
      : [];

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ products: [] });
  }
}
