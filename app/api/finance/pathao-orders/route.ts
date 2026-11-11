import { NextRequest, NextResponse } from 'next/server';
import { getPathaoPortalOrders, type PathaoPortalOrder } from '@/lib/integrations/pathao';
import { getWooOrderTotals } from '@/lib/integrations/woocommerce';
import { pathaoLabel, pathaoStage } from '@/lib/orders/pathaoStatus';
import { amountReplaced, getParcelAmounts, rememberParcelAmounts, saveParcelAmounts } from '@/lib/orders/parcelAmounts';

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
  /** what the parcel was booked on Pathao to collect */
  toCollect: number;
  /** false when Pathao already replaced the amount and the original couldn't be found */
  toCollectKnown: boolean;
  /** what Pathao actually collected: the amount when delivered, the charge on a paid return, else 0 */
  collected: number;
  fee: number;
  /** Pathao's own status wording, e.g. "On the Way To Delivery Hub" */
  status: string;
  outcome: DeliveryOutcome;
};

// A parcel heading back to us is a return for this view, even before it arrives
const RETURNING = new Set(['return-in-transit', 'return-id-created', 'return-pending']);
const slugOf = (status: string) => pathaoLabel(status).toLowerCase().replace(/\s+/g, '-');

function outcomeOf(status: string): DeliveryOutcome {
  if (RETURNING.has(slugOf(status))) return 'returned';
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
    const raw = (await getPathaoPortalOrders(from, to)).filter(p => !isReverse(p) && p.order_type !== 'Estimated');
    const orderId = (p: PathaoPortalOrder) => Number(String(p.merchant_order_id || '').replace(/\D/g, '')) || 0;
    await rememberParcelAmounts(raw);
    const booked = await getParcelAmounts(raw.map(p => p.order_consignment_id));

    // Paid returns and partial deliveries seen for the first time no longer carry the
    // booked amount: use the order total from WooCommerce (the amount we book with)
    const unknown = raw.filter(p => !booked.has(p.order_consignment_id) && orderId(p) && amountReplaced(p.order_status || ''));
    if (unknown.length) {
      const totals = await Promise.race([
        getWooOrderTotals(unknown.map(orderId)),
        new Promise<Map<number, number>>(r => setTimeout(() => r(new Map()), 8000)),
      ]).catch(() => new Map<number, number>());
      const found = unknown.filter(p => totals.has(orderId(p)));
      for (const p of found) booked.set(p.order_consignment_id, totals.get(orderId(p))!);
      await saveParcelAmounts(found.map(p => ({ consignment_id: p.order_consignment_id, amount: totals.get(orderId(p))!, merchant_order_id: String(p.merchant_order_id), source: 'woocommerce' })));
    }

    const parcels: SentParcel[] = raw.map(p => {
      const status = p.order_status || 'Unknown';
      const outcome = outcomeOf(status);
      const amount = Number(p.order_amount) || 0;
      const slug = slugOf(status);
      const collected = outcome === 'delivered' || slug === 'paid-return' ? amount : 0;
      return {
        consignmentId: p.order_consignment_id,
        orderNumber: String(p.merchant_order_id || '').trim(),
        date: p.order_created_at.slice(0, 10),
        createdAt: p.order_created_at,
        updatedAt: p.order_status_updated_at || '',
        customer: p.recipient_name || '',
        phone: p.recipient_phone || '',
        address: p.recipient_address || '',
        items: p.order_description || '',
        toCollect: booked.get(p.order_consignment_id) ?? amount,
        toCollectKnown: booked.has(p.order_consignment_id) || !amountReplaced(status),
        collected,
        fee: Number(p.total_fee || p.delivery_fee) || 0,
        status: status.trim(),
        outcome,
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ from, to, fetchedAt: new Date().toISOString(), parcels });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not load Pathao orders' }, { status: 500 });
  }
}
