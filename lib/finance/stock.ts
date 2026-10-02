// Stock on hand, valued at production cost, with how fast each product sells.
// Feeds Finance → Products (stock value) and Scale Ops (stock cover).

import { dashboardCache } from '@/lib/cache';
import { getWooStockLevels, getWooUnitsSold } from '@/lib/integrations/woocommerce';
import { addDays, todayISO } from './periods';
import { getBatchAverageUnitCost, getFinanceSettings, getProductCosts } from './products';

export interface StockProduct {
  id: number;
  name: string;
  sku: string;
  image: string | null;
  price: number;
  stock: number;
  unitCost: number;
  /** true when the cost comes from Finance → Products rather than the default */
  specificCost: boolean;
  costValue: number;
  retailValue: number;
  sold30: number;
  sold90: number;
  /** Order value of the last 90 days (WooCommerce line totals) */
  revenue90: number;
  /** Share of available units that sold in 30 days: sold ÷ (sold + on hand) */
  sellThrough30: number;
  /** A = products making the first 80% of 90-day sales, B = next 15%, C = the rest */
  abc: 'A' | 'B' | 'C';
  /** Units sold per week, oldest first, the last 13 weeks ending today */
  weekly: number[];
  /** Days the current stock lasts at the 30-day sales pace; null when nothing sold */
  coverDays: number | null;
  variants: { id: number; size: string; sku: string; stock: number; sold30: number; sold90: number; coverDays: number | null }[];
}

export interface StockSnapshot {
  asOf: string;
  products: StockProduct[];
  totals: { units: number; costValue: number; retailValue: number; sold30: number; coverDays: number | null; deadUnits: number; deadValue: number };
}

const SNAPSHOT_KEY = 'finance_stock_snapshot_v2';

/** Drop cached stock (and views built on it) after a stock change. */
export function invalidateStockSnapshot() {
  for (const k of [SNAPSHOT_KEY, 'ops_v1', 'finance_alerts_v1']) dashboardCache.delete(k);
}

const cover = (stock: number, sold30: number) => (sold30 > 0 ? stock / (sold30 / 30) : null);

export async function getStockSnapshot(force = false): Promise<StockSnapshot> {
  const key = SNAPSHOT_KEY;
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

  const WEEKS = 13;
  const byProduct = new Map<number, { s30: number; s90: number; rev: number; weekly: number[] }>();
  const byVariation = new Map<number, { s30: number; s90: number }>();
  for (const s of sold) {
    const p = byProduct.get(s.productId) || { s30: 0, s90: 0, rev: 0, weekly: Array(WEEKS).fill(0) };
    p.s90 += s.quantity;
    p.rev += s.total;
    const weeksAgo = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${s.date}T00:00:00Z`)) / (7 * 86_400_000));
    if (weeksAgo >= 0 && weeksAgo < WEEKS) p.weekly[WEEKS - 1 - weeksAgo] += s.quantity;
    if (s.variationId) {
      const v = byVariation.get(s.variationId) || { s30: 0, s90: 0 };
      v.s90 += s.quantity;
      if (s.date >= d30) v.s30 += s.quantity;
      byVariation.set(s.variationId, v);
    }
    if (s.date >= d30) p.s30 += s.quantity;
    byProduct.set(s.productId, p);
  }

  const products: StockProduct[] = levels.map(l => {
    const c = costs.get(l.id);
    const unitCost = c ? c.unit_cost : fallback;
    const s = byProduct.get(l.id) || { s30: 0, s90: 0, rev: 0, weekly: Array(WEEKS).fill(0) };
    return {
      id: l.id, name: l.name, sku: l.sku, image: l.image, price: l.price, stock: l.stock, unitCost, specificCost: !!c,
      costValue: l.stock * unitCost, retailValue: l.stock * l.price,
      sold30: s.s30, sold90: s.s90, revenue90: s.rev, weekly: s.weekly,
      sellThrough30: s.s30 + l.stock > 0 ? s.s30 / (s.s30 + l.stock) : 0,
      abc: 'C' as StockProduct['abc'],
      coverDays: cover(l.stock, s.s30),
      variants: l.variants.map(v => {
        const vs = byVariation.get(v.id) || { s30: 0, s90: 0 };
        return { ...v, sold30: vs.s30, sold90: vs.s90, coverDays: cover(v.stock, vs.s30) };
      }),
    };
  }).filter(p => p.stock > 0 || p.sold90 > 0)
    .sort((a, b) => b.costValue - a.costValue);

  // ABC classes by 90-day sales value
  const totalRev = products.reduce((t, p) => t + p.revenue90, 0);
  let running = 0;
  for (const p of [...products].sort((a, b) => b.revenue90 - a.revenue90)) {
    const before = totalRev ? running / totalRev : 1;
    running += p.revenue90;
    p.abc = p.revenue90 <= 0 ? 'C' : before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C';
  }

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
