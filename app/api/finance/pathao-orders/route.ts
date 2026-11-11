import { NextRequest, NextResponse } from 'next/server';
import { getPathaoPortalOrders, type PathaoPortalOrder } from '@/lib/integrations/pathao';
import { pathaoLabel, pathaoStage } from '@/lib/orders/pathaoStatus';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type DeliveryOutcome = 'delivered' | 'returned' | 'on_way' | 'waiting' | 'cancelled';

export type SentParcel = {
  consignmentId: string;
  orderNumber: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  customer: string;
  phone: string;
  address: string;
  items: string;
  amount: number;
  fee: number;
  status: string;
  outcome: DeliveryOutcome;
};

// A parcel heading back to us is a return for this view, even before it arrives
const RETURNING = new Set(['return-in-transit', 'return-id-created']);

function outcomeOf(status: string): DeliveryOutcome {
  const slug = pathaoLabel(status).toLowerCase().replace(/\s+/g, '-');
  if (RETURNING.has(slug)) return 'returned';
  switch (pathaoStage(status)) {
    case 'delivered': return 'delivered';
    case 'returned': return 'returned';
    case 'pre_pickup': return 'waiting';
    case 'pickup_cancelled': return 'cancelled';
    default: return 'on_way';
  }
}

// Return shipments Pathao creates to bring a parcel back aren't orders we sent
const isReverse = (p: PathaoPortalOrder) => p.order_type === 'Return' || /^R[SE]/.test(p.order_consignment_id || '');

/** Every parcel booked on Pathao between `from` and `to` (by booking date), with its delivery outcome. */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') || '';
  const to = req.nextUrl.searchParams.get('to') || '';
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ error: 'from and to must be dates (YYYY-MM-DD)' }, { status: 400 });
  }
  try {
    const raw = await getPathaoPortalOrders(from, to);
    const parcels: SentParcel[] = raw
      .filter(p => !isReverse(p) && p.order_type !== 'Estimated')
      .map(p => ({
        consignmentId: p.order_consignment_id,
        orderNumber: String(p.merchant_order_id || '').trim(),
        date: p.order_created_at.slice(0, 10),
        createdAt: p.order_created_at,
        updatedAt: p.order_status_updated_at || '',
        customer: p.recipient_name || '',
        phone: p.recipient_phone || '',
        address: p.recipient_address || '',
        items: p.order_description || '',
        amount: Number(p.order_amount) || 0,
        fee: Number(p.total_fee || p.delivery_fee) || 0,
        status: pathaoLabel(p.order_status || 'Unknown'),
        outcome: outcomeOf(p.order_status || ''),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ from, to, fetchedAt: new Date().toISOString(), parcels });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not load Pathao orders' }, { status: 500 });
  }
}
