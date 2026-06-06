import { NextResponse } from "next/server";
import { hasEnv, requiredWooEnv } from "@/lib/integrations/env";

type WooProduct = {
  id: number;
  name: string;
  sku: string;
  price: string;
  type: "simple" | "variable";
  stock_quantity: number | null;
  stock_status: string;
  attributes: Array<{ name: string; options: string[] }>;
  variations: number[];
};

type WooVariation = {
  id: number;
  sku: string;
  stock_quantity: number | null;
  stock_status: string;
  attributes: Array<{ name: string; option: string }>;
};

type SizeKey = "S" | "M" | "L" | "XL";
const SIZES = new Set<SizeKey>(["S", "M", "L", "XL"]);

type InventoryItem = {
  product: string; sku: string; color: string; price: number;
  sizes: Record<SizeKey, number>; totalStock: number;
  weeklyDemand: number; percentage: number;
};

type LowStockEntry = { sku: string; product: string; current: number; reorderPoint: number };

function getWooBaseURL() {
  return (process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
}

async function wooFetch<T>(endpoint: string): Promise<T> {
  const auth = Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`
  ).toString("base64");
  const res = await fetch(`${getWooBaseURL()}/wp-json/wc/v3${endpoint}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WooCommerce ${endpoint} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

function normalizeSize(raw: string): SizeKey | null {
  const s = raw.toUpperCase().trim();
  if (SIZES.has(s as SizeKey)) return s as SizeKey;
  if (s === "SMALL") return "S";
  if (s === "MEDIUM") return "M";
  if (s === "LARGE") return "L";
  if (s.startsWith("EXTRA LARGE")) return "XL";
  return null;
}

function emptyMatrix(): Record<SizeKey, number> {
  return { S: 0, M: 0, L: 0, XL: 0 };
}

function buildItem(totalStock: number, product: WooProduct, color: string, sizes: Record<SizeKey, number>): InventoryItem {
  const weeklyDemand = Math.max(5, Math.round(totalStock * 0.3));
  const percentage = Math.min(100, Math.round((weeklyDemand / Math.max(1, totalStock)) * 100));
  const price = Number.parseFloat(product.price) || 0;
  return { product: product.name, sku: product.sku, color, price, sizes, totalStock, weeklyDemand, percentage };
}

function processVariation(
  v: WooVariation,
  product: WooProduct,
  sizes: Record<SizeKey, number>,
  color: string,
  lowStock: LowStockEntry[],
): string {
  const sizeAttr = v.attributes.find((a) => a.name.toLowerCase().includes("size"));
  const colorAttr = v.attributes.find((a) =>
    a.name.toLowerCase().includes("color") || a.name.toLowerCase().includes("colour")
  );
  const resolvedColor = colorAttr && !color ? colorAttr.option : color;

  const qty = v.stock_quantity ?? 0;
  const sizeKey = sizeAttr ? normalizeSize(sizeAttr.option) : null;
  if (sizeKey) {
    sizes[sizeKey] += qty;
  } else {
    sizes.M += qty;
  }

  if (qty > 0 && qty <= 5) {
    const variantSku = v.sku || [product.sku, v.id].join("-");
    const variantName = sizeAttr ? product.name + " — " + sizeAttr.option : product.name;
    lowStock.push({ sku: variantSku, product: variantName, current: qty, reorderPoint: 10 });
  }

  return resolvedColor;
}

async function processProduct(
  product: WooProduct,
  lowStock: LowStockEntry[],
): Promise<InventoryItem | null> {
  const sizes = emptyMatrix();
  let color = "";

  if (product.type === "variable" && product.variations.length > 0) {
    const variations = await wooFetch<WooVariation[]>(
      `/products/${product.id}/variations?per_page=100`
    );
    for (const v of variations) {
      color = processVariation(v, product, sizes, color, lowStock);
    }
  } else {
    const qty = product.stock_quantity ?? 0;
    sizes.M = qty;
    if (qty > 0 && qty <= 5) {
      lowStock.push({ sku: product.sku, product: product.name, current: qty, reorderPoint: 10 });
    }
  }

  const totalStock = Object.values(sizes).reduce((a, b) => a + b, 0);
  if (totalStock === 0) return null;

  return buildItem(totalStock, product, color, sizes);
}

function mockInventory(): InventoryItem[] {
  return [
    { product: "Black Linen Shirt",   sku: "BLS", color: "Black", price: 1200, sizes: { S: 12, M: 15, L: 10, XL: 6  }, totalStock: 43, weeklyDemand: 13, percentage: 30 },
    { product: "White Cotton Robe",   sku: "WCR", color: "White", price: 1500, sizes: { S: 8,  M: 12, L: 14, XL: 9  }, totalStock: 43, weeklyDemand: 13, percentage: 30 },
    { product: "Navy Chambray Shirt", sku: "NCS", color: "Navy",  price: 1350, sizes: { S: 14, M: 18, L: 16, XL: 11 }, totalStock: 59, weeklyDemand: 18, percentage: 31 },
  ];
}

export async function GET() {
  if (!hasEnv(requiredWooEnv)) {
    return NextResponse.json({ items: mockInventory(), lowStock: [], isMock: true });
  }

  try {
    const products = await wooFetch<WooProduct[]>(
      "/products?per_page=100&status=publish&orderby=title&order=asc"
    );

    const lowStock: LowStockEntry[] = [];
    const itemResults = await Promise.all(products.map((p) => processProduct(p, lowStock)));
    const items = itemResults.filter((i): i is InventoryItem => i !== null);

    return NextResponse.json({ items, lowStock, isMock: false });
  } catch (error) {
    console.error("Inventory API error:", error);
    return NextResponse.json({ items: mockInventory(), lowStock: [], isMock: true });
  }
}
