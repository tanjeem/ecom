import { NextResponse } from 'next/server';
import { getWooCatalog } from '@/lib/integrations/woocommerce';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Published products in shop order, with prices and stock for every size. Always live from WooCommerce. */
export async function GET() {
  try {
    return NextResponse.json({ fetchedAt: new Date().toISOString(), products: await getWooCatalog() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not load products' }, { status: 500 });
  }
}
