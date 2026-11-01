// Brings WooCommerce orders up to date with Pathao: writes the consignment id
// and the parcel's current status onto each order, and moves the order's
// status forward (processing/packed → dispatched → completed or cancelled).
//
// Pathao's webhook is meant to do this live, but it only reaches us when it is
// set up in the Pathao dashboard, so this sync is the safety net: it runs from
// the Orders page (throttled), a daily cron and the "Sync with Pathao" button.
//
// Matching, safest first:
// 1. The order already stores a consignment id → that parcel.
// 2. A parcel whose merchant order id is this order → accepted only when the
//    phone number (or, when Pathao has no phone, the amount) also matches, so a
//    parcel from another store on the same Pathao account can't attach itself.
// 3. No order id on the parcel (booked by hand in the Pathao portal): the same
//    phone, the same amount, booked within 7 days of the order, and no other
//    order already owns that parcel. Weaker lookalikes are only reported.

import { dashboardCache } from '@/lib/cache';
import { getPathaoPortalOrders, type PathaoPortalOrder } from '@/lib/integrations/pathao';
import { batchUpdateWooOrders, getWooOrdersForSync, type WooSyncOrder as WooOrder } from '@/lib/integrations/woocommerce';
import { canMoveTo, pathaoLabel, pathaoStage, wooStatusForStage } from './pathaoStatus';

const OPEN_STATUSES = ['pending', 'processing', 'on-hold', 'packed', 'dispatched'];

const phone10 = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
const isReverse = (p: PathaoPortalOrder) => p.order_type === 'Return' || /^R[SE]/.test(p.order_consignment_id || '');

export type SyncChange = {
  id: number; number: string; consignmentId: string; pathaoStatus: string;
  from: string; to: string | null; how: 'consignment' | 'order-id' | 'phone+amount';
};

export type SyncReport = {
  ranAt: string;
  dryRun: boolean;
  checked: number;
  parcels: number;
  changes: SyncChange[];
  summary: { dispatched: number; completed: number; cancelled: number; metaOnly: number };
  /** Pathao cancelled the pickup — rebook or cancel by hand */
  pickupCancelled: { id: number; number: string; consignmentId: string }[];
  /** Same phone number, different/no order id on the parcel — check by hand */
  possible: { id: number; number: string; consignmentId: string; pathaoStatus: string; parcelOrderId: string }[];
  /** Order id matched but phone and amount didn't — refused */
  refused: { id: number; number: string; consignmentId: string; reason: string }[];
  /** Returned over 60 days ago — not cancelled automatically, because cancelling puts the items back in stock */
  oldReturns: { id: number; number: string; consignmentId: string; pathaoStatus: string; dateCreated: string }[];
  /** Open for 3+ days with no Pathao parcel found */
  notBooked: { id: number; number: string; status: string; dateCreated: string }[];
  applied: { updated: number; failed: { id: number; error: string }[] } | null;
};

/**
 * @param history  also check old open orders (default: orders from the last 120 days)
 */
export async function syncOrdersWithPathao({ dryRun = false, history = false } = {}): Promise<SyncReport> {
  const since = history ? undefined : new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const [orders, parcels] = await Promise.all([
    getWooOrdersForSync(OPEN_STATUSES, since),
    getPathaoPortalOrders(),
  ]);

  const forward = parcels.filter(p => !isReverse(p));
  const byConsignment = new Map(forward.map(p => [p.order_consignment_id, p]));
  // Latest parcel per merchant order id (an order can be rebooked)
  const byOrderId = new Map<string, PathaoPortalOrder>();
  const byPhone = new Map<string, PathaoPortalOrder[]>();
  for (const p of forward) {
    const mid = String(p.merchant_order_id || '').replace(/\D/g, '');
    if (mid) {
      const prev = byOrderId.get(mid);
      if (!prev || p.order_created_at > prev.order_created_at) byOrderId.set(mid, p);
    }
    const ph = phone10(p.recipient_phone);
    if (ph) byPhone.set(ph, [...(byPhone.get(ph) || []), p]);
  }

  const report: SyncReport = {
    ranAt: new Date().toISOString(), dryRun, checked: orders.length, parcels: forward.length, changes: [],
    summary: { dispatched: 0, completed: 0, cancelled: 0, metaOnly: 0 },
    pickupCancelled: [], possible: [], refused: [], oldReturns: [], notBooked: [], applied: null,
  };
  const updates: { id: number; status?: string; meta_data: { key: string; value: string }[] }[] = [];

  // Parcels already owned by an order: stored on one, or carrying another order's id
  const claimed = new Set(orders.map(o => o.consignmentId).filter(Boolean));
  const hasOrderId = (p: PathaoPortalOrder) => /^\d+$/.test(String(p.merchant_order_id || '').trim());
  const days = (from: string, to: string) => (Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000;
  const nearbyByPhone = (o: WooOrder, maxDays: number) =>
    (byPhone.get(phone10(o.phone)) || []).filter(p => {
      const d = days(o.dateCreated, p.order_created_at);
      return d >= 0 && d <= maxDays && !claimed.has(p.order_consignment_id) && !hasOrderId(p);
    });

  for (const o of orders) {
    let parcel: PathaoPortalOrder | undefined;
    let how: SyncChange['how'] = 'consignment';
    if (o.consignmentId) parcel = byConsignment.get(o.consignmentId);
    if (!parcel) {
      const candidate = byOrderId.get(String(o.id)) || byOrderId.get(o.number);
      if (candidate) {
        const pPhone = phone10(candidate.recipient_phone);
        const phoneOk = pPhone && phone10(o.phone) === pPhone;
        const amountOk = !pPhone && Math.abs((Number(candidate.order_amount) || 0) - o.total) <= 1;
        if (phoneOk || amountOk) { parcel = candidate; how = 'order-id'; }
        else report.refused.push({ id: o.id, number: o.number, consignmentId: candidate.order_consignment_id, reason: pPhone ? 'phone differs' : 'amount differs' });
      }
    }

    if (!parcel && !o.consignmentId && phone10(o.phone)) {
      const strong = nearbyByPhone(o, 7).filter(p => Math.abs((Number(p.order_amount) || 0) - o.total) <= 1);
      if (strong.length === 1) { parcel = strong[0]; how = 'phone+amount'; }
    }

    if (!parcel) {
      const ageDays = (Date.now() - Date.parse(o.dateCreated)) / 86_400_000;
      const lookalike = !o.consignmentId && ageDays <= 120 ? nearbyByPhone(o, 14)[0] : undefined;
      if (lookalike) {
        report.possible.push({ id: o.id, number: o.number, consignmentId: lookalike.order_consignment_id, pathaoStatus: lookalike.order_status, parcelOrderId: String(lookalike.merchant_order_id || '') });
      } else if (ageDays >= 3 && o.status !== 'dispatched' && !o.consignmentId) {
        report.notBooked.push({ id: o.id, number: o.number, status: o.status, dateCreated: o.dateCreated.slice(0, 10) });
      }
      continue;
    }

    claimed.add(parcel.order_consignment_id);
    const stage = pathaoStage(parcel.order_status);
    const label = pathaoLabel(parcel.order_status);
    const target = wooStatusForStage(stage);
    let move = target && canMoveTo(o.status, target) ? target : null;
    // WooCommerce restocks a cancelled order's items. Right for a recent return; for an
    // old one the stock was most likely corrected by hand already, so leave it to a person.
    if (move === 'cancelled' && (Date.now() - Date.parse(o.dateCreated)) / 86_400_000 > 60) {
      report.oldReturns.push({ id: o.id, number: o.number, consignmentId: parcel.order_consignment_id, pathaoStatus: label, dateCreated: o.dateCreated.slice(0, 10) });
      move = null;
    }
    if (stage === 'pickup_cancelled' && o.status !== 'cancelled') {
      report.pickupCancelled.push({ id: o.id, number: o.number, consignmentId: parcel.order_consignment_id });
    }

    const metaChanged = o.consignmentId !== parcel.order_consignment_id || pathaoLabel(o.pathaoStatus || '') !== label || !o.bookedByUs;
    if (!move && !metaChanged) continue;

    report.changes.push({ id: o.id, number: o.number, consignmentId: parcel.order_consignment_id, pathaoStatus: label, from: o.status, to: move, how });
    if (move) report.summary[move]++; else report.summary.metaOnly++;
    updates.push({
      id: o.id,
      ...(move ? { status: move } : {}),
      meta_data: [
        { key: 'ptc_consignment_id', value: parcel.order_consignment_id },
        { key: 'ptc_status', value: label },
        { key: 'pathao_consignment_id', value: parcel.order_consignment_id },
        { key: 'pathao_status', value: label },
        // Verified match: lets the Pathao webhook update this order from now on
        { key: 'ptc_booked_by_us', value: '1' },
      ],
    });
  }

  if (!dryRun && updates.length) {
    report.applied = await batchUpdateWooOrders(updates);
    dashboardCache.clear();
  }
  return report;
}

// ── throttled background run, used when the Orders page loads ──────────────

const LAST_KEY = 'pathao_sync_last';
const MIN_GAP_MS = 10 * 60 * 1000;
let running: Promise<SyncReport> | null = null;

/** Runs the sync unless one ran in the last 10 minutes (or is running). Never throws. */
export async function syncIfStale(): Promise<SyncReport | null> {
  const last = dashboardCache.get<SyncReport>(LAST_KEY);
  if (running || (last && Date.now() - Date.parse(last.ranAt) < MIN_GAP_MS)) return null;
  running = syncOrdersWithPathao()
    .then(r => { dashboardCache.set(LAST_KEY, r, 24 * 60 * 60 * 1000); return r; })
    .finally(() => { running = null; });
  try { return await running; } catch (e) { console.error('[Pathao sync]', e); return null; }
}

export const lastSyncReport = () => dashboardCache.get<SyncReport>(LAST_KEY);
export const rememberSyncReport = (r: SyncReport) => { if (!r.dryRun) dashboardCache.set(LAST_KEY, r, 24 * 60 * 60 * 1000); };

