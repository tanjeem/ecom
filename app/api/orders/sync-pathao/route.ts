import { NextRequest, NextResponse } from 'next/server';
import { lastSyncReport, rememberSyncReport, syncOrdersWithPathao } from '@/lib/orders/pathaoSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The most recent sync result (from the button, the Orders page or the cron). */
export function GET() {
  return NextResponse.json({ report: lastSyncReport() });
}

/** Run the Pathao → WooCommerce sync now. `{ dryRun: true }` previews without writing; `{ history: true }` includes old orders. */
export async function POST(req: NextRequest) {
  let body: { dryRun?: boolean; history?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body = defaults */ }
  try {
    const report = await syncOrdersWithPathao({ dryRun: !!body.dryRun, history: !!body.history });
    rememberSyncReport(report);
    return NextResponse.json({ report });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Sync failed' }, { status: 500 });
  }
}
