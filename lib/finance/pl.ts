// Pure P&L maths, safe to import from both server and browser code.

import { COST_GROUPS, type CostGroupKey, type PLBreakdown } from './types';

export const emptyGroups = (): Record<CostGroupKey, number> =>
  ({ production: 0, marketing: 0, overhead: 0, logistics: 0, other: 0 });

export const CAT_TO_GROUP: Record<string, CostGroupKey> = {};
for (const g of COST_GROUPS) for (const c of g.cats) CAT_TO_GROUP[c] = g.key;

/** Folds a category → amount map into a P&L statement. */
export function plFromCats(cats: Record<string, number>): PLBreakdown {
  const v = (k: string) => cats[k] || 0;
  // Revenue is cash Pathao collected on paid invoices — nothing else. Income logged
  // by hand (prepaid, direct, other) sits below operating profit as other income.
  const revenue = {
    pathao_cod: v('pathao_cod'), sales_prepaid: v('sales_prepaid'), sales_cod: v('sales_cod'),
    other_income: v('other_income'), total: 0,
  };
  revenue.total = revenue.pathao_cod;
  const other_income = revenue.sales_prepaid + revenue.sales_cod + revenue.other_income;

  const cogs = { product_cost: v('product_cost'), fabric: v('fabric'), accessories: v('accessories'), sewing: v('sewing'), packaging_material: v('packaging_material'), total: 0 };
  cogs.total = cogs.product_cost + cogs.fabric + cogs.accessories + cogs.sewing + cogs.packaging_material;

  const opex = {
    rent: v('rent'), salary: v('salary'), transport: v('transport'), courier_fees: v('courier_fees'),
    ads_meta: v('ads_meta'), ads_google: v('ads_google'), photoshoot: v('photoshoot'), miscellaneous: v('miscellaneous'), total: 0,
  };
  opex.total = opex.rent + opex.salary + opex.transport + opex.courier_fees + opex.ads_meta + opex.ads_google + opex.photoshoot + opex.miscellaneous;

  const groups = emptyGroups();
  for (const [cat, amt] of Object.entries(cats)) {
    const g = CAT_TO_GROUP[cat];
    if (g) groups[g] += amt;
  }

  const gross_profit = revenue.total - cogs.total;
  const operating_profit = gross_profit - opex.total;
  const net_profit = operating_profit + other_income;
  return {
    revenue, cogs, opex, groups,
    expenses: cogs.total + opex.total,
    gross_profit,
    operating_profit,
    other_income,
    gross_margin: revenue.total > 0 ? (gross_profit / revenue.total) * 100 : 0,
    net_profit,
    net_margin: revenue.total > 0 ? (net_profit / revenue.total) * 100 : 0,
  };
}

