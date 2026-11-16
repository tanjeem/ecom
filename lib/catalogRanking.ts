// Pure ranking maths for the Products page, safe for server and browser.

export type ProductStat = { views: number; orders: number; units: number; revenue: number };
export type SortMode = 'conversion' | 'views' | 'orders';

/** How many views a product needs before its own conversion rate outweighs the shop average. */
export const PRIOR_VIEWS = 300;

/** Orders ÷ views across every product that has views (the shop-wide conversion rate). */
export function shopConversion(stats: Map<number, ProductStat>): number {
  let views = 0;
  let orders = 0;
  for (const s of stats.values()) if (s.views > 0) { views += s.views; orders += s.orders; }
  return views ? orders / views : 0;
}

/**
 * Conversion rate pulled toward the shop average while views are few, so a
 * product with 4 views and 1 order doesn't jump above one with 2,000 views and
 * 40 orders. With PRIOR_VIEWS views it sits halfway between its own rate and the average.
 */
export const smoothedConversion = (s: ProductStat | undefined, avg: number) =>
  ((s?.orders || 0) + PRIOR_VIEWS * avg) / ((s?.views || 0) + PRIOR_VIEWS);

/**
 * New order for `ids`. In-stock products are ranked by the chosen measure (ties keep
 * their current order); sold-out ones go to the end in their current order, since
 * the shop hides them anyway.
 */
export function rankIds(ids: number[], stats: Map<number, ProductStat>, mode: SortMode, inStock: (id: number) => boolean): number[] {
  const avg = shopConversion(stats);
  const score = (id: number) => {
    const s = stats.get(id);
    if (mode === 'views') return [s?.views || 0, s?.orders || 0];
    if (mode === 'orders') return [s?.orders || 0, s?.views || 0];
    return [smoothedConversion(s, avg), s?.orders || 0];
  };
  const pos = new Map(ids.map((id, i) => [id, i]));
  const ranked = ids.filter(inStock).sort((a, b) => {
    const [a1, a2] = score(a);
    const [b1, b2] = score(b);
    return b1 - a1 || b2 - a2 || pos.get(a)! - pos.get(b)!;
  });
  return [...ranked, ...ids.filter(id => !inStock(id))];
}
