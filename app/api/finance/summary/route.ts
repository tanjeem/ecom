import { NextRequest, NextResponse } from 'next/server';
import { buildFinanceSummary } from '@/lib/finance/summary';
import { autoGranularity, daysBetween, todayISO, type Granularity } from '@/lib/finance/periods';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const GRANULARITIES: Granularity[] = ['day', 'week', 'month', 'quarter', 'year'];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const today = todayISO();
  const from = sp.get('from') || `${today.slice(0, 7)}-01`;
  const to = sp.get('to') || today;

  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ error: 'from/to must be YYYY-MM-DD with from ≤ to' }, { status: 400 });
  }
  if (daysBetween(from, to) > 366 * 5) {
    return NextResponse.json({ error: 'Range too long (max 5 years)' }, { status: 400 });
  }

  const g = sp.get('granularity') as Granularity | null;
  let granularity = g && GRANULARITIES.includes(g) ? g : autoGranularity(from, to);
  // Daily buckets over very long ranges are unreadable and slow
  if (granularity === 'day' && daysBetween(from, to) > 400) granularity = 'month';

  try {
    const summary = await buildFinanceSummary({
      from, to, granularity, includeInvoice: sp.get('invoice') === '1',
    });
    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to build summary' }, { status: 500 });
  }
}
