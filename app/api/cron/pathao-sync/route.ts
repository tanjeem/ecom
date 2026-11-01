import { NextResponse } from 'next/server';
import { rememberSyncReport, syncOrdersWithPathao } from '@/lib/orders/pathaoSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily Pathao → WooCommerce order sync (Vercel cron, see vercel.json). */
export async function GET() {
  try {
    const r = await syncOrdersWithPathao();
    rememberSyncReport(r);
    return NextResponse.json({ ok: true, checked: r.checked, ...r.summary, failed: r.applied?.failed.length ?? 0, ranAt: r.ranAt });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
