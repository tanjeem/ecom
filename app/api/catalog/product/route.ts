import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { invalidateStockSnapshot } from '@/lib/finance/stock';
import { getWooStockById, saveWooCatalogChanges, type CatalogChange } from '@/lib/integrations/woocommerce';

export const dynamic = 'force-dynamic';

type Row = { variationId: number | null; size?: string; regularPrice?: string; salePrice?: string; stock?: number; stockWas?: number };

const PRICE = /^\d{1,7}(\.\d{1,2})?$/;

/**
 * Save price and stock edits for one product. Body: `{ productId, productName, changes: Row[] }`.
 * Each row names a size (variationId) or the product itself (null) and carries only what changed.
 * Prices come as the final regular and sale price together; an empty sale price ends the sale.
 * A stock change is refused for a size whose stock moved (e.g. an order) since `stockWas` was read.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const productId = Number(b.productId);
    const rows: Row[] = Array.isArray(b.changes) ? b.changes : [];
    if (!Number.isInteger(productId) || productId <= 0) return NextResponse.json({ error: 'productId required' }, { status: 400 });
    if (!rows.length) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });

    for (const r of rows) {
      const label = r.size || 'this product';
      if (r.variationId != null && (!Number.isInteger(r.variationId) || r.variationId <= 0)) return NextResponse.json({ error: 'Bad size id' }, { status: 400 });
      if (r.regularPrice !== undefined || r.salePrice !== undefined) {
        const reg = String(r.regularPrice ?? '').trim();
        const sale = String(r.salePrice ?? '').trim();
        if (!PRICE.test(reg) || Number(reg) <= 0) return NextResponse.json({ error: `${label}: enter a regular price` }, { status: 400 });
        if (sale && !PRICE.test(sale)) return NextResponse.json({ error: `${label}: the sale price isn’t a number` }, { status: 400 });
        if (sale && Number(sale) >= Number(reg)) return NextResponse.json({ error: `${label}: the sale price must be lower than the regular price` }, { status: 400 });
        r.regularPrice = reg;
        r.salePrice = sale;
      }
      if (r.stock !== undefined && (!Number.isInteger(r.stock) || r.stock < 0 || r.stock > 100_000)) {
        return NextResponse.json({ error: `${label}: stock must be a whole number, 0 or more` }, { status: 400 });
      }
    }

    // Don't overwrite sales that happened while the page was open
    const stockRows = rows.filter(r => r.stock !== undefined);
    const live = stockRows.length ? await getWooStockById(productId) : new Map<number | null, number>();
    const moved = stockRows.filter(r => live.get(r.variationId) !== r.stockWas);
    if (moved.length) {
      const list = moved.map(r => `${r.size || 'stock'} is now ${live.get(r.variationId) ?? '?'}`).join(', ');
      return NextResponse.json({ error: `Stock changed since you opened this (${list}). Reload and try again.`, stale: true }, { status: 409 });
    }

    const changes: CatalogChange[] = rows.map(r => ({
      variationId: r.variationId ?? null,
      ...(r.regularPrice !== undefined ? { regularPrice: r.regularPrice, salePrice: r.salePrice } : {}),
      ...(r.stock !== undefined ? { stock: r.stock } : {}),
    }));
    await saveWooCatalogChanges(productId, changes);
    invalidateStockSnapshot();

    // Stock edits go in the same log as Inventory's adjustments
    let logged = true;
    if (stockRows.length) {
      const { error } = await supabase.from('inv_adjustments').insert(stockRows.map(r => ({
        product_id: productId, variation_id: r.variationId ?? null,
        product_name: String(b.productName || '').slice(0, 200) || `#${productId}`,
        size: r.size ? String(r.size).slice(0, 60) : null,
        before_qty: r.stockWas, after_qty: r.stock, reason: 'count', note: 'Edited on the Products page',
        created_by: req.headers.get('x-auth-user'),
      })));
      logged = !error;
    }
    return NextResponse.json({ saved: rows.length, logged });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not save' }, { status: 500 });
  }
}
