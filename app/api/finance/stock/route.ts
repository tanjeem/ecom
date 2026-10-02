import { NextRequest, NextResponse } from 'next/server';
import { getStockSnapshot } from '@/lib/finance/stock';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getStockSnapshot(req.nextUrl.searchParams.get('refresh') === '1'));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not load stock' }, { status: 500 });
  }
}
