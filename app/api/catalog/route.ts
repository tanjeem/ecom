import { NextResponse } from 'next/server';
import { getWooCatalog, wooCategories } from '@/lib/integrations/woocommerce';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Published products in shop order, with prices and stock for every size. Always live from WooCommerce. */
export async function GET() {
  try {
    const [products, categories] = await Promise.all([getWooCatalog(), wooCategories().catch(() => [])]);
    return NextResponse.json({ fetchedAt: new Date().toISOString(), products, categories: categories.filter(c => c.name !== 'Uncategorized') });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not load products' }, { status: 500 });
  }
}
