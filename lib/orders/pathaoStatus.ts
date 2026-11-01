// One mapping from Pathao parcel statuses to WooCommerce order statuses, shared
// by the webhook and the background sync so both move orders the same way.
// Pathao sends statuses as words ("Paid Return") in its order list and as
// slugs ("order.paid-return") in webhooks; both are accepted.

export type PathaoStage = 'pre_pickup' | 'in_transit' | 'delivered' | 'returned' | 'pickup_cancelled' | 'unknown';

const slug = (status: string) =>
  status.toLowerCase().trim().replace(/^order\./, '').replace(/[\s_]+/g, '-').replace(/-the-/g, '-');

const STAGES: Record<string, PathaoStage> = {
  'pending': 'pre_pickup', 'created': 'pre_pickup', 'pickup-requested': 'pre_pickup', 'assigned-for-pickup': 'pre_pickup',
  'pickup-failed': 'pre_pickup',
  'picked': 'in_transit', 'at-sorting-hub': 'in_transit', 'in-transit': 'in_transit', 'received-at-last-mile-hub': 'in_transit',
  'assigned-for-delivery': 'in_transit', 'on-hold': 'in_transit', 'delivery-failed': 'in_transit', 'return-in-transit': 'in_transit',
  'return-id-created': 'in_transit',
  'delivered': 'delivered', 'partial-delivery': 'delivered', 'exchange': 'delivered', 'exchanged': 'delivered',
  'return': 'returned', 'returned': 'returned', 'paid-return': 'returned', 'returned-to-merchant': 'returned',
  'pickup-cancel': 'pickup_cancelled', 'pickup-cancelled': 'pickup_cancelled', 'cancelled': 'pickup_cancelled',
};

export const pathaoStage = (status: string): PathaoStage => STAGES[slug(status)] ?? 'unknown';

/** "order.paid-return" / "paid-return" → "Paid Return", so stored statuses read the same however they arrived. */
export const pathaoLabel = (status: string) =>
  slug(status).split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

/**
 * WooCommerce status a parcel stage implies. Pickup cancellations are left for a
 * person to decide (the parcel is often rebooked), so they return null.
 */
export function wooStatusForStage(stage: PathaoStage): 'dispatched' | 'completed' | 'cancelled' | null {
  if (stage === 'in_transit') return 'dispatched';
  if (stage === 'delivered') return 'completed';
  if (stage === 'returned') return 'cancelled';
  return null;
}

// Orders only move forward. Anything a person finished by hand (completed,
// cancelled, refunded, failed…) is never changed by the courier.
const RANK: Record<string, number> = { pending: 0, processing: 0, 'on-hold': 0, packed: 1, dispatched: 2, completed: 3, cancelled: 3 };

export function canMoveTo(current: string, next: string): boolean {
  if (!(current in RANK) || RANK[current] >= 3) return false;
  return RANK[next] > RANK[current];
}
