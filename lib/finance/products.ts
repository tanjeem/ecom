// Links invoiced Pathao deliveries to the WooCommerce products they carried,
// and resolves what each unit cost to make. Powers per-unit COGS in the
// summary and the Products profitability view.

import { supabase } from '@/lib/supabase';
import { dashboardCache } from '@/lib/cache';
import { getWooOrderLineItems, type WooLineItem } from '@/lib/integrations/woocommerce';
import type { PathaoInvoiceLine } from '@/lib/integrations/pathao';

export type CogsMethod = 'per_unit' | 'cash';

export interface FinanceSettings {
  cogsMethod: CogsMethod;
  defaultUnitCost: number | null;
  pathaoPayoutAccount: string | null;
}

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const { data } = await supabase.from('fin_settings').select('key, value');
  const map = new Map((data || []).map((r: any) => [r.key, r.value]));
  const num = map.get('default_unit_cost');
  return {
    cogsMethod: map.get('cogs_method') === 'cash' ? 'cash' : 'per_unit',
    defaultUnitCost: typeof num === 'number' && num >= 0 ? num : null,
    pathaoPayoutAccount: typeof map.get('pathao_payout_account') === 'string' ? map.get('pathao_payout_account') : null,
  };
}

/** Weighted average absorbed cost per first-quality unit across production batches. */
export async function getBatchAverageUnitCost(): Promise<number | null> {
  const { data } = await supabase.from('prod_fabric_batches').select('first_quality_qty, absorbed_unit_cost');
  let units = 0;
  let cost = 0;
  for (const b of data || []) {
    const q = Number(b.first_quality_qty) || 0;
    const c = Number(b.absorbed_unit_cost) || 0;
    if (q > 0 && c > 0) { units += q; cost += q * c; }
  }
  return units ? cost / units : null;
}

export async function getProductCosts(): Promise<Map<number, { name: string; unit_cost: number }>> {
  const { data } = await supabase.from('fin_product_costs').select('product_id, name, unit_cost');
  return new Map((data || []).map((r: any) => [Number(r.product_id), { name: r.name, unit_cost: Number(r.unit_cost) }]));
}

// ─── Woo line items, cached (an order's items never change once shipped) ─────

const ITEMS_CACHE_KEY = 'woo_order_line_items_v1';
let _items: Record<string, WooLineItem[]> | null = null;

export async function lineItemsFor(orderIds: string[]): Promise<Map<string, WooLineItem[]>> {
  if (!_items) _items = dashboardCache.get<Record<string, WooLineItem[]>>(ITEMS_CACHE_KEY) || {};
  const missing = [...new Set(orderIds)].filter(id => id && /^\d+$/.test(id) && !(id in _items!));
  if (missing.length) {
    try {
      const fetched = await getWooOrderLineItems(missing.map(Number));
      for (const id of missing) _items[id] = fetched.get(Number(id)) || []; // [] = order gone; don't refetch
      dashboardCache.set(ITEMS_CACHE_KEY, _items, 30 * 24 * 60 * 60 * 1000);
    } catch (e) {
      console.error('[finance] WooCommerce line items unavailable:', e);
    }
  }
  return new Map(orderIds.filter(id => _items![id]).map(id => [id, _items![id]]));
}

// ─── per-delivery cost ───────────────────────────────────────────────────────

export interface CostContext {
  costs: Map<number, { name: string; unit_cost: number }>;
  fallbackUnitCost: number;
  items: Map<string, WooLineItem[]>;
  /** Average units per linked delivery — used for deliveries we can't link */
  avgUnits: number;
}

export async function buildCostContext(lines: PathaoInvoiceLine[], settings: FinanceSettings): Promise<CostContext> {
  const [costs, batchAvg] = await Promise.all([getProductCosts(), getBatchAverageUnitCost()]);
  const ids = lines.filter(l => l.type === 'delivery' && l.merchant_order_id).map(l => l.merchant_order_id);
  const items = await lineItemsFor(ids);
  // Store-wide average over every order we know the items of, so unlinked parcels
  // are priced the same whichever date range is being viewed
  let units = 0;
  let linked = 0;
  for (const li of Object.values(_items || {})) {
    if (li.length) { linked++; units += li.reduce((s, x) => s + x.quantity, 0); }
  }
  return {
    costs,
    fallbackUnitCost: settings.defaultUnitCost ?? batchAvg ?? 0,
    items,
    avgUnits: linked ? units / linked : 1,
  };
}

export interface DeliveryCost {
  units: number;
  cost: number;
  /** Units priced with a product-specific cost (vs the fallback) */
  pricedUnits: number;
  linked: boolean;
  items: { product_id: number; name: string; quantity: number; total: number; unitCost: number; specific: boolean }[];
}

export function costOfDelivery(line: PathaoInvoiceLine, ctx: CostContext): DeliveryCost {
  const li = line.merchant_order_id ? ctx.items.get(line.merchant_order_id) : undefined;
  if (!li?.length) {
    return { units: ctx.avgUnits, cost: ctx.avgUnits * ctx.fallbackUnitCost, pricedUnits: 0, linked: false, items: [] };
  }
  let units = 0;
  let cost = 0;
  let priced = 0;
  const items = li.map(x => {
    const specific = ctx.costs.get(x.product_id);
    const unitCost = specific ? specific.unit_cost : ctx.fallbackUnitCost;
    units += x.quantity;
    cost += x.quantity * unitCost;
    if (specific) priced += x.quantity;
    return { ...x, unitCost, specific: !!specific };
  });
  return { units, cost, pricedUnits: priced, linked: true, items };
}
