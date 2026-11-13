import { NextRequest, NextResponse } from 'next/server';
import { getWooCatalog, setWooMenuOrder } from '@/lib/integrations/woocommerce';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Save the shop order. Body: `{ ids: number[] }`, published product ids, first = top of the shop.
 * Products are renumbered 1..N and only the ones whose position changed are written.
 * A product published since the list was loaded keeps its place after the given ones.
 */
export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: 'ids must be a list of product ids' }, { status: 400 });
    }
    const current = await getWooCatalog();
    const live = new Map(current.map(p => [p.id, p.menuOrder]));
    const order = [...ids.filter((id: number) => live.has(id)), ...current.map(p => p.id).filter(id => !ids.includes(id))];
    const updates = order.map((id, i) => ({ id, menuOrder: i + 1 })).filter(u => live.get(u.id) !== u.menuOrder);
    if (updates.length) await setWooMenuOrder(updates);
    // "moved" = products whose place on the shop changed; renumbering alone doesn't count
    const moved = order.filter((id, i) => current[i]?.id !== id).length;
    return NextResponse.json({ moved, written: updates.length, total: order.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not save the order' }, { status: 500 });
  }
}
