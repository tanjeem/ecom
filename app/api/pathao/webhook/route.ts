import { NextRequest, NextResponse } from 'next/server';
import { dashboardCache } from '@/lib/cache';
import { AccountingEngine } from '@/lib/services/AccountingEngine';

// The secret Pathao requires us to return in the response header
// Found in: Pathao dashboard → Webhook Integration → Secret
const WEBHOOK_SECRET = process.env.PATHAO_WEBHOOK_SECRET || 'f3992ecc-59da-4cbe-a049-a13da2018d51';

function wooAuth() {
  return Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
  ).toString('base64');
}

function wooBase() {
  return (process.env.WOOCOMMERCE_URL || '').replace(/\/$/, '');
}

/**
 * Fetch an order's currently stored Pathao consignment ID meta value and whether it
 * carries the "booked by us" marker, if any.
 */
async function getOrderPathaoMeta(orderId: number): Promise<{ consignmentId: string | null; bookedByUs: boolean }> {
  const res = await fetch(`${wooBase()}/wp-json/wc/v3/orders/${orderId}`, {
    headers: { Authorization: `Basic ${wooAuth()}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return { consignmentId: null, bookedByUs: false };
  const order = await res.json() as { meta_data?: Array<{ key: string; value: unknown }> };
  const consignmentMeta = order.meta_data?.find((m) => m.key === 'ptc_consignment_id' || m.key === 'pathao_consignment_id');
  const bookedMeta = order.meta_data?.find((m) => m.key === 'ptc_booked_by_us');
  return {
    consignmentId: typeof consignmentMeta?.value === 'string' && consignmentMeta.value ? consignmentMeta.value : null,
    bookedByUs: bookedMeta?.value === '1' || bookedMeta?.value === 1,
  };
}

/**
 * Find WooCommerce order ID by consignment ID stored in meta.
 * Falls back to merchant_order_id if provided (which Pathao sets to the WooCommerce order ID).
 *
 * An order is ONLY ever trusted if it carries the `ptc_booked_by_us` marker — written
 * exclusively by our own createPathaoOrder/bulkCreatePathaoOrders calls at booking time.
 * Without this marker, no lookup path (merchant_order_id OR consignment-id meta search)
 * will match the order, no matter how many webhook events arrive for it. This closes the
 * hole where a foreign Pathao shipment (e.g. from another store on the same merchant
 * account) that happened to attach itself once would keep getting "confirmed" on every
 * subsequent status update for that same consignment ID.
 */
async function findWooOrderId(consignmentId: string, merchantOrderId?: string): Promise<number | null> {
  // Pathao sets merchant_order_id to the WooCommerce order number/id when we create orders
  // Try that first as it's a direct lookup
  if (merchantOrderId) {
    const numId = Number.parseInt(merchantOrderId.replace(/\D/g, ''), 10);
    if (!Number.isNaN(numId)) {
      const { consignmentId: existing, bookedByUs } = await getOrderPathaoMeta(numId);
      if (bookedByUs && (existing === consignmentId || existing === null)) return numId;
      console.warn(
        `[Pathao Webhook] merchant_order_id ${merchantOrderId} resolved to order #${numId}, ` +
        `but it is not marked as booked by us (bookedByUs=${bookedByUs}, existing=${existing}). ` +
        `Refusing to adopt; falling back to meta lookup.`,
      );
    }
  }

  // Fallback: search by meta key — still requires the booked-by-us marker
  const res = await fetch(
    `${wooBase()}/wp-json/wc/v3/orders?meta_key=ptc_consignment_id&meta_value=${encodeURIComponent(consignmentId)}&per_page=5`,
    { headers: { Authorization: `Basic ${wooAuth()}`, Accept: 'application/json' }, cache: 'no-store' },
  );
  if (!res.ok) return null;
  const orders = await res.json() as Array<{ id: number }>;
  if (!Array.isArray(orders) || orders.length === 0) return null;
  if (orders.length > 1) {
    console.warn(
      `[Pathao Webhook] Ambiguous match: ${orders.length} orders share consignment ${consignmentId}. ` +
      `Refusing to guess; skipping update.`,
    );
    return null;
  }
  const candidateId = orders[0].id;
  const { bookedByUs } = await getOrderPathaoMeta(candidateId);
  if (!bookedByUs) {
    console.warn(
      `[Pathao Webhook] Meta lookup matched order #${candidateId} for consignment ${consignmentId}, ` +
      `but it is not marked as booked by us — refusing to update.`,
    );
    return null;
  }
  return candidateId;
}

/**
 * Update WooCommerce order meta with latest Pathao status + consignment ID.
 */
async function updateWooOrderMeta(orderId: number, consignmentId: string, status: string) {
  const metaData = [
    { key: 'ptc_consignment_id', value: consignmentId },
    { key: 'ptc_status', value: status },
    // Also write legacy keys for compatibility
    { key: 'pathao_consignment_id', value: consignmentId },
    { key: 'pathao_status', value: status },
  ];

  const res = await fetch(`${wooBase()}/wp-json/wc/v3/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${wooAuth()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ meta_data: metaData }),
    cache: 'no-store',
  });

  return res.ok;
}

/**
 * Pathao Webhook receiver.
 *
 * Pathao requirements (from their dashboard):
 * - Must return HTTP 202
 * - Must return header: X-Pathao-Merchant-Webhook-Integration-Secret: <secret>
 *
 * Webhook URL to set in Pathao dashboard:
 *   https://ecom-tau-pearl.vercel.app/api/pathao/webhook
 *
 * Payload shape:
 * {
 *   event: "order_status_update" | "webhook_integration" | ...
 *   consignment_id: "DS2505...",
 *   merchant_order_id: "7612",
 *   order_status: "Delivered",
 *   ...
 * }
 */
export async function POST(request: NextRequest) {
  const secretHeader = {
    'X-Pathao-Merchant-Webhook-Integration-Secret': WEBHOOK_SECRET,
  };

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: false, error: 'Invalid JSON' }, { status: 202, headers: secretHeader });
  }

  const event           = typeof body.event            === 'string' ? body.event            : '';
  const consignmentId   = typeof body.consignment_id   === 'string' ? body.consignment_id   :
                          typeof body.consignment_i_d  === 'string' ? body.consignment_i_d  : '';
  const orderStatus     = typeof body.order_status     === 'string' ? body.order_status     :
                          typeof body.status            === 'string' ? body.status            : '';
  const merchantOrderId = typeof body.merchant_order_id === 'string' ? body.merchant_order_id :
                          typeof body.order_id          === 'string' ? body.order_id          : '';
  const storeId         = typeof body.store_id === 'number' ? body.store_id :
                          typeof body.store_id === 'string' ? Number.parseInt(body.store_id, 10) : undefined;

  // Pathao merchant webhooks are account-wide and can include events for OTHER stores
  // under the same merchant account (e.g. a second shop configured in the Pathao dashboard).
  // If the payload identifies which store the event belongs to, reject anything that isn't
  // our configured store outright — this is the primary defense against that store's order
  // numbers colliding with ours via merchant_order_id.
  const ourStoreId = Number(process.env.PATHAO_STORE_ID);
  if (storeId !== undefined && !Number.isNaN(ourStoreId) && storeId !== ourStoreId) {
    console.warn(`[Pathao Webhook] Ignoring event for foreign store_id ${storeId} (ours: ${ourStoreId})`);
    return NextResponse.json({ received: true, ignored: 'foreign_store' }, { status: 202, headers: secretHeader });
  }

  if (consignmentId && orderStatus) {
    try {
      const wooOrderId = await findWooOrderId(consignmentId, merchantOrderId);
      if (wooOrderId) {
        const updated = await updateWooOrderMeta(wooOrderId, consignmentId, orderStatus);
        console.log(`[Pathao Webhook] WooCommerce order #${wooOrderId} updated to "${orderStatus}" — success: ${updated}`);
        
        // Zero-Leakage Accounting State Machine Hook
        try {
          const orderValue = typeof body.collected_amount === 'number' ? body.collected_amount : 0;
          const fees = typeof body.delivery_charge === 'number' ? body.delivery_charge : 0;
          // In a full integration, landedCogs would be fetched from Woo order line items cross-referenced with Supabase master_products
          const landedCogs = 0; 
          
          await AccountingEngine.handleCourierWebhook(
            wooOrderId.toString(),
            orderStatus.toLowerCase(),
            orderValue,
            fees,
            landedCogs
          );
        } catch (accErr) {
          console.error('[Pathao Webhook] AccountingEngine Error:', accErr);
        }

        if (updated) {
          dashboardCache.clear();
        }
      } else {
        console.warn(`[Pathao Webhook] Could not find WooCommerce order for consignment ${consignmentId} / merchant_order_id ${merchantOrderId}`);
      }
    } catch (err) {
      console.error('[Pathao Webhook] Error updating WooCommerce:', err);
      // Still return 202 so Pathao doesn't retry endlessly
    }
  }

  return NextResponse.json({ received: true, event, consignmentId, orderStatus }, { status: 202, headers: secretHeader });
}

// Pathao also sends a GET request to verify the URL during setup
export async function GET() {
  return NextResponse.json(
    { status: 'ok', service: 'Pathao webhook receiver' },
    {
      status: 202,
      headers: { 'X-Pathao-Merchant-Webhook-Integration-Secret': WEBHOOK_SECRET },
    },
  );
}
