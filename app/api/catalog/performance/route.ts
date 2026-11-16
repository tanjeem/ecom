import { NextRequest, NextResponse } from 'next/server';
import { getWooProductSales } from '@/lib/integrations/woocommerce';
import { getProductViews, jetpackConfigured } from '@/lib/integrations/jetpackStats';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAYS = new Set([7, 14, 30, 90]);
const TTL = 15 * 60_000;
const cache = new Map<string, { at: number; body: any }>();

const dhakaDate = (offsetDays = 0) => new Date(Date.now() + 6 * 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * Per product over the last N days: page views (Jetpack) and website orders
 * (WooCommerce checkout), for ranking the shop by what converts.
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days')) || 30;
  if (!DAYS.has(days)) return NextResponse.json({ error: 'days must be 7, 14, 30 or 90' }, { status: 400 });
  const fresh = req.nextUrl.searchParams.get('refresh') === '1';
  const key = String(days);
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

  const from = dhakaDate(days - 1);
  const to = dhakaDate();
  const connected = jetpackConfigured();
  const [salesRes, viewsRes] = await Promise.allSettled([
    getWooProductSales(from),
    connected ? getProductViews(days) : Promise.reject(new Error('not connected')),
  ]);
  if (salesRes.status === 'rejected') {
    return NextResponse.json({ error: `Could not load orders: ${salesRes.reason?.message || salesRes.reason}` }, { status: 502 });
  }
  const sales = salesRes.value.byProduct;
  const views = viewsRes.status === 'fulfilled' ? viewsRes.value : null;

  const ids = new Set<number>([...sales.keys(), ...(views?.keys() || [])]);
  const products = [...ids].map(id => ({
    id,
    views: views?.get(id) ?? 0,
    orders: sales.get(id)?.orders ?? 0,
    units: sales.get(id)?.units ?? 0,
    revenue: Math.round(sales.get(id)?.revenue ?? 0),
  }));

  const body = {
    days, from, to, fetchedAt: new Date().toISOString(), orders: salesRes.value.orders,
    views: views ? { ok: true } : { ok: false, connected, error: connected && viewsRes.status === 'rejected' ? String(viewsRes.reason?.message || viewsRes.reason) : null },
    products,
  };
  if (views) cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
