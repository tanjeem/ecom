import { NextRequest, NextResponse } from 'next/server';

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
 * Find WooCommerce order ID by consignment ID stored in meta.
 * Falls back to merchant_order_id if provided (which Pathao sets to the WooCommerce order ID).
 */
async function findWooOrderId(consignmentId: string, merchantOrderId?: string): Promise<number | null> {
  // Pathao sets merchant_order_id to the WooCommerce order number/id when we create orders
  // Try that first as it's a direct lookup
  if (merchantOrderId) {
    const numId = Number.parseInt(merchantOrderId.replace(/\D/g, ''), 10);
    if (!Number.isNaN(numId)) return numId;
  }

  // Fallback: search by meta key
  const res = await fetch(
    `${wooBase()}/wp-json/wc/v3/orders?meta_key=ptc_consignment_id&meta_value=${encodeURIComponent(consignmentId)}&per_page=5`,
    { headers: { Authorization: `Basic ${wooAuth()}`, Accept: 'application/json' }, cache: 'no-store' },
  );
  if (!res.ok) return null;
  const orders = await res.json() as Array<{ id: number }>;
  return Array.isArray(orders) && orders.length > 0 ? orders[0].id : null;
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
 *   https://<your-domain>/api/pathao/webhook
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

  if (consignmentId && orderStatus) {
    try {
      const wooOrderId = await findWooOrderId(consignmentId, merchantOrderId);
      if (wooOrderId) {
        const updated = await updateWooOrderMeta(wooOrderId, consignmentId, orderStatus);
        console.log(`[Pathao Webhook] WooCommerce order #${wooOrderId} updated to "${orderStatus}" — success: ${updated}`);
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
