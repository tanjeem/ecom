// Stock on hand, valued at production cost, with how fast each product sells.
// Feeds Finance → Products (stock value) and Scale Ops (stock cover).

import { dashboardCache } from '@/lib/cache';
import { getWooStockLevels, getWooUnitsSold } from '@/lib/integrations/woocommerce';
import { addDays, todayISO } from './periods';
import { getBatchAverageUnitCost, getFinanceSettings, getProductCosts } from './products';

export interface StockProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  unitCost: number;
  /** true when the cost comes from Finance → Products rather than the default */
  specificCost: boolean;
  costValue: number;
  retailValue: number;
  sold30: number;
  sold90: number;
  /** Days the current stock lasts at the 30-day sales pace; null when nothing sold */
  coverDays: number | null;
  variants: { id: number; size: string; stock: number; sold30: number; coverDays: number | null }[];
}

export interface StockSnapshot {
  asOf: string;
  products: StockProduct[];
  totals: { units: number; costValue: number; retailValue: number; sold30: number; coverDays: number | null; deadUnits: number; deadValue: number };
}

const cover = (stock: number, sold30: number) => (sold30 > 0 ? stock / (sold30 / 30) : null);

export async function getStockSnapshot(force = false): Promise<StockSnapshot> {
  const key = 'finance_stock_snapshot_v1';
  if (!force) {
    const cached = dashboardCache.get<StockSnapshot>(key);
    if (cached) return cached;
  }
  const today = todayISO();
  const d30 = addDays(today, -29);
  const [levels, sold, costs, settings, batchAvg] = await Promise.all([
    getWooStockLevels(),
    getWooUnitsSold(addDays(today, -89)),
    getProductCosts(),
    getFinanceSettings(),
    getBatchAverageUnitCost(),
  ]);
  const fallback = settings.defaultUnitCost ?? batchAvg ?? 0;

  const byProduct = new Map<number, { s30: number; s90: number }>();
  const byVariation = new Map<number, number>();
  for (const s of sold) {
    const p = byProduct.get(s.productId) || { s30: 0, s90: 0 };
    p.s90 += s.quantity;
    if (s.date >= d30) {
      p.s30 += s.quantity;
      if (s.variationId) byVariation.set(s.variationId, (byVariation.get(s.variationId) || 0) + s.quantity);
    }
    byProduct.set(s.productId, p);
  }

  const products: StockProduct[] = levels.map(l => {
    const c = costs.get(l.id);
    const unitCost = c ? c.unit_cost : fallback;
    const s = byProduct.get(l.id) || { s30: 0, s90: 0 };
    return {
      id: l.id, name: l.name, price: l.price, stock: l.stock, unitCost, specificCost: !!c,
      costValue: l.stock * unitCost, retailValue: l.stock * l.price,
      sold30: s.s30, sold90: s.s90, coverDays: cover(l.stock, s.s30),
      variants: l.variants.map(v => {
        const v30 = byVariation.get(v.id) || 0;
        return { ...v, sold30: v30, coverDays: cover(v.stock, v30) };
      }),
    };
  }).filter(p => p.stock > 0 || p.sold90 > 0)
    .sort((a, b) => b.costValue - a.costValue);

  const units = products.reduce((s, p) => s + p.stock, 0);
  const sold30 = products.reduce((s, p) => s + p.sold30, 0);
  // Dead stock: on hand but not a single sale in 90 days
  const dead = products.filter(p => p.stock > 0 && p.sold90 === 0);
  const snap: StockSnapshot = {
    asOf: new Date().toISOString(),
    products,
    totals: {
      units,
      costValue: products.reduce((s, p) => s + p.costValue, 0),
      retailValue: products.reduce((s, p) => s + p.retailValue, 0),
      sold30,
      coverDays: cover(units, sold30),
      deadUnits: dead.reduce((s, p) => s + p.stock, 0),
      deadValue: dead.reduce((s, p) => s + p.costValue, 0),
    },
  };
  dashboardCache.set(key, snap, 15 * 60 * 1000);
  return snap;
}
