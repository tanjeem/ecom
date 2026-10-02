import { NextResponse } from 'next/server';
import { getCashPosition } from '@/lib/finance/position';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getCashPosition());
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load cash position' }, { status: 500 });
  }
}
