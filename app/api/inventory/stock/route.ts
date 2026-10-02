import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getStockSnapshot, invalidateStockSnapshot } from '@/lib/finance/stock';
import { getWooStock, setWooStock } from '@/lib/integrations/woocommerce';

export const dynamic = 'force-dynamic';

const REASONS = new Set(['restock', 'count', 'damaged', 'return', 'sample', 'other']);

/** Stock with sales velocity, plus the latest manual adjustments. */
export async function GET(req: NextRequest) {
  try {
    const [snapshot, adj] = await Promise.all([
      getStockSnapshot(req.nextUrl.searchParams.get('refresh') === '1'),
      supabase.from('inv_adjustments').select('*').order('created_at', { ascending: false }).limit(40),
    ]);
    return NextResponse.json({ ...snapshot, adjustments: adj.data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not load stock' }, { status: 500 });
  }
}

/**
 * Change a stock count in WooCommerce and log it. `mode: 'add'` adds `quantity`
 * (negative to remove); `mode: 'set'` sets the count outright (a stock take).
 * The "before" figure is read live from WooCommerce, not from the cache.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const productId = Number(b.product_id);
    const variationId = b.variation_id ? Number(b.variation_id) : null;
    const qty = Number(b.quantity);
    if (!Number.isInteger(productId) || productId <= 0) return NextResponse.json({ error: 'product_id required' }, { status: 400 });
    if (variationId != null && (!Number.isInteger(variationId) || variationId <= 0)) return NextResponse.json({ error: 'Bad variation_id' }, { status: 400 });
    if (!Number.isInteger(qty) || Math.abs(qty) > 100_000) return NextResponse.json({ error: 'Quantity must be a whole number' }, { status: 400 });
    if (b.mode !== 'add' && b.mode !== 'set') return NextResponse.json({ error: "mode must be 'add' or 'set'" }, { status: 400 });
    if (!REASONS.has(b.reason)) return NextResponse.json({ error: 'Pick a reason' }, { status: 400 });
    if (b.mode === 'set' && qty < 0) return NextResponse.json({ error: 'Stock can’t be negative' }, { status: 400 });

    const before = await getWooStock(productId, variationId);
    const target = b.mode === 'set' ? qty : before + qty;
    if (target < 0) return NextResponse.json({ error: `Only ${before} in stock — can’t remove ${-qty}` }, { status: 400 });
    const after = await setWooStock(productId, variationId, target);

    const { error } = await supabase.from('inv_adjustments').insert({
      product_id: productId, variation_id: variationId,
      product_name: String(b.product_name || '').slice(0, 200) || `#${productId}`,
      size: b.size ? String(b.size).slice(0, 60) : null,
      before_qty: before, after_qty: after, reason: b.reason,
      note: b.note ? String(b.note).slice(0, 300) : null,
      created_by: req.headers.get('x-auth-user'),
    });
    invalidateStockSnapshot();
    // The stock is changed even if logging failed; say so rather than hide it
    return NextResponse.json({ before, after, logged: !error, logError: error?.message });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not update stock' }, { status: 500 });
  }
}
