import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPathaoInvoiceLines } from '@/lib/integrations/pathao';
import { buildCostContext, costOfDelivery, getFinanceSettings, lineItemsFor } from '@/lib/finance/products';
import { buildFinanceSummary } from '@/lib/finance/summary';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Line item names carry the variation ("Miles | Denim Pant - S"); costs and rows are per product
const baseName = (name: string) => name.replace(/\s+-\s+(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|\d{2})$/i, '').trim();

type Row = {
  product_id: number; name: string; unitCost: number; specificCost: boolean;
  units: number; orders: number; revenue: number; cogs: number; fees: number;
  returnedUnits: number; returnFees: number; ads: number; profit: number; margin: number; returnRate: number;
};

/**
 * Profit per product for invoices in [from, to]: invoiced revenue and Pathao
 * fees split across an order's items by their WooCommerce line value, units ×
 * unit cost, return fees from return invoice lines, and the period's ad spend
 * allocated by revenue share.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ error: 'from/to must be YYYY-MM-DD with from ≤ to' }, { status: 400 });
  }

  try {
    const [lines, settings, summary] = await Promise.all([
      getPathaoInvoiceLines(),
      getFinanceSettings(),
      buildFinanceSummary({ from, to, granularity: 'month' }),
    ]);
    const inRange = lines.filter(l => l.invoice_date >= from && l.invoice_date <= to);
    const deliveries = inRange.filter(l => l.type === 'delivery');
    const returns = inRange.filter(l => l.type === 'return');
    const ctx = await buildCostContext(deliveries, settings);
    const returnItems = await lineItemsFor(returns.map(l => l.merchant_order_id).filter(Boolean));

    const rows = new Map<number, Row>();
    const row = (id: number, name: string, unitCost: number, specific: boolean) => {
      let r = rows.get(id);
      if (!r) {
        r = { product_id: id, name: baseName(name), unitCost, specificCost: specific, units: 0, orders: 0, revenue: 0, cogs: 0, fees: 0, returnedUnits: 0, returnFees: 0, ads: 0, profit: 0, margin: 0, returnRate: 0 };
        rows.set(id, r);
      }
      return r;
    };
    const unlinked = { orders: 0, revenue: 0, cogs: 0, fees: 0, returnFees: 0, returns: 0 };

    for (const l of deliveries) {
      const c = costOfDelivery(l, ctx);
      if (!c.linked) {
        unlinked.orders++; unlinked.revenue += l.collected; unlinked.cogs += c.cost; unlinked.fees += l.fee;
        continue;
      }
      const lineTotal = c.items.reduce((s, x) => s + x.total, 0);
      for (const it of c.items) {
        const share = lineTotal > 0 ? it.total / lineTotal : 1 / c.items.length;
        const r = row(it.product_id, it.name, it.unitCost, it.specific);
        r.units += it.quantity;
        r.orders++;
        r.revenue += l.collected * share;
        r.cogs += it.quantity * it.unitCost;
        r.fees += l.fee * share;
      }
    }

    for (const l of returns) {
      const items = l.merchant_order_id ? returnItems.get(l.merchant_order_id) : undefined;
      if (!items?.length) { unlinked.returns++; unlinked.returnFees += l.fee; continue; }
      const units = items.reduce((s, x) => s + x.quantity, 0) || 1;
      for (const it of items) {
        const cost = ctx.costs.get(it.product_id);
        const r = row(it.product_id, it.name, cost?.unit_cost ?? ctx.fallbackUnitCost, !!cost);
        r.returnedUnits += it.quantity;
        r.returnFees += l.fee * (it.quantity / units);
      }
    }

    // Ads are a period cost — spread across products by their share of revenue
    const adSpend = summary.pl.opex.ads_meta + summary.pl.opex.ads_google;
    const totalRevenue = [...rows.values()].reduce((s, r) => s + r.revenue, 0) + unlinked.revenue;
    for (const r of rows.values()) {
      r.ads = totalRevenue ? adSpend * (r.revenue / totalRevenue) : 0;
      r.profit = r.revenue - r.cogs - r.fees - r.returnFees - r.ads;
      r.margin = r.revenue ? (r.profit / r.revenue) * 100 : 0;
      r.returnRate = r.units + r.returnedUnits ? (r.returnedUnits / (r.units + r.returnedUnits)) * 100 : 0;
    }

    // Products with a saved cost that didn't sell still show up, so costs can be managed here
    const { data: saved } = await supabase.from('fin_product_costs').select('product_id, name, unit_cost');
    for (const s of saved || []) row(Number(s.product_id), s.name, Number(s.unit_cost), true);

    return NextResponse.json({
      range: { from, to },
      products: [...rows.values()].sort((a, b) => b.revenue - a.revenue),
      unlinked: { ...unlinked, ads: totalRevenue ? adSpend * (unlinked.revenue / totalRevenue) : 0 },
      adSpend,
      fallbackUnitCost: ctx.fallbackUnitCost,
      cogsMethod: settings.cogsMethod,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to build product report' }, { status: 500 });
  }
}

/** Save a product's unit cost. Body: { product_id, name, unit_cost } — unit_cost null removes it. */
export async function PUT(req: NextRequest) {
  try {
    const { product_id, name, unit_cost } = await req.json();
    const id = Number(product_id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'product_id required' }, { status: 400 });
    if (unit_cost === null || unit_cost === '') {
      const { error } = await supabase.from('fin_product_costs').delete().eq('product_id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, removed: true });
    }
    const cost = Number(unit_cost);
    if (!Number.isFinite(cost) || cost < 0) return NextResponse.json({ error: 'unit_cost must be ≥ 0' }, { status: 400 });
    const { error } = await supabase.from('fin_product_costs').upsert({
      product_id: id, name: String(name || `Product ${id}`), unit_cost: cost, updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
