// The amount each Pathao parcel was booked to collect. Pathao overwrites a
// parcel's amount with the return charge once it becomes a "Paid Return", and lowers it on a partial delivery, so
// we keep the original the first time we see the parcel.

import { supabase } from '@/lib/supabase';
import type { PathaoPortalOrder } from '@/lib/integrations/pathao';

const TABLE = 'pathao_parcel_amounts';

// Statuses where Pathao has replaced the booked amount with what it actually collected
const AMOUNT_REPLACED = new Set(['paidreturn', 'partialdelivery']);
export const amountReplaced = (status: string) => AMOUNT_REPLACED.has(status.toLowerCase().replace(/[\s_-]+/g, ''));

/** Save the booked amount of every parcel not yet recorded. Never overwrites, never throws. */
export async function rememberParcelAmounts(parcels: PathaoPortalOrder[]): Promise<void> {
  const rows = parcels
    .filter(p => p.order_consignment_id && !amountReplaced(p.order_status || ''))
    .map(p => ({ consignment_id: p.order_consignment_id, amount: Number(p.order_amount) || 0, merchant_order_id: String(p.merchant_order_id || '') || null }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(TABLE).upsert(rows.slice(i, i + 500), { onConflict: 'consignment_id', ignoreDuplicates: true });
    if (error) { console.error('[Parcel amounts]', error.message); return; }
  }
}

/** Save amounts worked out another way (e.g. the WooCommerce order total). */
export async function saveParcelAmounts(rows: { consignment_id: string; amount: number; merchant_order_id: string | null; source: string }[]) {
  if (!rows.length) return;
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'consignment_id', ignoreDuplicates: true });
  if (error) console.error('[Parcel amounts]', error.message);
}

export async function getParcelAmounts(consignmentIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < consignmentIds.length; i += 300) {
    const { data, error } = await supabase.from(TABLE).select('consignment_id, amount').in('consignment_id', consignmentIds.slice(i, i + 300));
    if (error) { console.error('[Parcel amounts]', error.message); break; }
    for (const r of data || []) out.set(r.consignment_id, Number(r.amount) || 0);
  }
  return out;
}
