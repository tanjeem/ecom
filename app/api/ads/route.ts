import { NextRequest, NextResponse } from 'next/server';
import { fetchMetaCampaignInsights } from '@/lib/integrations/meta';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const period = sp.get('period') || 'month';
  const from = sp.get('from') || undefined;
  const to = sp.get('to') || undefined;

  try {
    const data = await fetchMetaCampaignInsights(period, from, to);
    return NextResponse.json(data);
  } catch (error) {
    console.error('API /api/ads error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
