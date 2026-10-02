import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dashboardCache } from '@/lib/cache';
import { getAllWooOrders, getWooOrdersInRange } from '@/lib/integrations/woocommerce';
import { getPathaoPortalOrders } from '@/lib/integrations/pathao';
import { getStockSnapshot } from '@/lib/finance/stock';
import { addDays, todayISO } from '@/lib/finance/periods';

export const dynamic = 'force-dynamic';

const DELIVERED = new Set(['Delivered', 'Partial Delivery']);
const RETURNED = new Set(['Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit', 'Paid Return', 'Delivery Failed']);
const DEAD = new Set(['Pickup Cancel', 'Pickup Cancelled', 'Cancelled', 'Payment Invoice', 'Exchange']); // Exchange = swap completed
const CANCELLED_WOO = new Set(['cancelled', 'failed', 'refunded', 'trash', 'checkout-draft']);

// Store time is Dhaka (UTC+6); Woo dates carry no zone
const ageHours = (local: string) => (Date.now() - Date.parse(`${local.slice(0, 19)}+06:00`)) / 3_600_000;
const zoneOf = (fee: number) => (fee <= 0 ? 'Unknown' : fee <= 80 ? 'Inside Dhaka' : fee <= 110 ? 'Dhaka suburbs' : 'Outside Dhaka');
const pct = (arr: number[], p: number) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null);

export const SETTING_KEYS = ['ops_daily_capacity', 'ops_lead_time_days', 'ops_sla_hours', 'ops_checklist'] as const;

async function opsSettings() {
  const { data } = await supabase.from('fin_settings').select('key, value').in('key', SETTING_KEYS as unknown as string[]);
  const m = new Map((data || []).map((r: any) => [r.key, r.value]));
  const num = (k: string, d: number | null) => (typeof m.get(k) === 'number' && m.get(k) > 0 ? m.get(k) : d);
  return {
    dailyCapacity: num('ops_daily_capacity', null) as number | null,
    leadTimeDays: num('ops_lead_time_days', 21) as number,
    slaHours: num('ops_sla_hours', 48) as number,
    checklist: (m.get('ops_checklist') && typeof m.get('ops_checklist') === 'object' ? m.get('ops_checklist') : {}) as Record<string, boolean>,
  };
}

/**
 * Operations health: what's waiting to ship, what's stuck with the courier,
 * how fast parcels arrive, how volume is trending against capacity, and which
 * products need restocking before they run out.
 */
export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get('refresh') === '1';
  const cached = dashboardCache.get<any>('ops_v1');
  const settings = await opsSettings();
  if (cached && !refresh) return NextResponse.json({ ...cached, settings });

  const today = todayISO();
  const [backlogRes, volumeRes, pathaoRes, stockRes, costsRes, accountsRes, budgetsRes] = await Promise.allSettled([
    getAllWooOrders(new URLSearchParams({
      status: 'processing,pending,on-hold,packed', after: `${addDays(today, -60)}T00:00:00`,
      _fields: 'id,number,status,total,date_created,billing,shipping,line_items,meta_data',
    })),
    getWooOrdersInRange(addDays(today, -83), addDays(today, 1)),
    getPathaoPortalOrders(),
    getStockSnapshot(refresh),
    supabase.from('fin_product_costs').select('product_id', { count: 'exact', head: true }),
    supabase.from('fin_accounts').select('id', { count: 'exact', head: true }),
    supabase.from('fin_budgets').select('id', { count: 'exact', head: true }),
  ]);
  const errors: Record<string, string> = {};
  const fail = (k: string, r: PromiseSettledResult<unknown>) => { if (r.status === 'rejected') errors[k] = String(r.reason?.message || r.reason); };
  fail('orders', backlogRes); fail('volume', volumeRes); fail('courier', pathaoRes); fail('stock', stockRes);

  // ── 1. waiting to ship ──
  const backlog = backlogRes.status === 'fulfilled' ? backlogRes.value.filter(o => !o.pathaoConsignment) : [];
  const waiting = backlog.map(o => ({
    id: o.id, wooId: o.wooId, customer: o.customer, status: o.status, total: o.total, items: o.items,
    created: o.dateCreated || '', ageHours: o.dateCreated ? ageHours(o.dateCreated) : 0,
  })).sort((a, b) => b.ageHours - a.ageHours);
  const fulfilment = {
    total: waiting.length,
    value: waiting.reduce((s, o) => s + o.total, 0),
    byStatus: { paid: waiting.filter(o => o.status === 'paid').length, packed: waiting.filter(o => o.status === 'packed').length, hold: waiting.filter(o => o.status === 'hold').length },
    age: {
      under24: waiting.filter(o => o.ageHours < 24).length,
      d1to2: waiting.filter(o => o.ageHours >= 24 && o.ageHours < 48).length,
      over48: waiting.filter(o => o.ageHours >= 48).length,
    },
    breaches: waiting.filter(o => o.status !== 'hold' && o.ageHours >= settings.slaHours).slice(0, 25),
    onHold: waiting.filter(o => o.status === 'hold').slice(0, 10),
  };

  // ── 2. with the courier ──
  const recent = addDays(today, -45);
  const parcels = pathaoRes.status === 'fulfilled'
    ? pathaoRes.value.filter(o => o.order_type !== 'Return' && !/^R[SE]/.test(o.order_consignment_id || '') && (o.order_created_at || '').slice(0, 10) >= recent)
    : [];
  const open = parcels.filter(o => !DELIVERED.has(o.order_status) && !RETURNED.has(o.order_status) && !DEAD.has(o.order_status));
  const statusCounts = new Map<string, number>();
  for (const o of open) statusCounts.set(o.order_status, (statusCounts.get(o.order_status) || 0) + 1);
  const daysOut = (o: { order_created_at: string }) => (Date.now() - Date.parse(o.order_created_at)) / 86_400_000;
  const stuck = open.filter(o => daysOut(o) >= 5).map(o => ({
    consignment: o.order_consignment_id, orderId: o.merchant_order_id, customer: o.recipient_name, phone: o.recipient_phone,
    status: o.order_status, days: Math.floor(daysOut(o)), amount: Number(o.order_amount) || 0, zone: zoneOf(Number(o.delivery_fee) || 0),
  })).sort((a, b) => b.days - a.days);

  // Delivery speed for the last 30 days, from Pathao's status timestamps
  const since30 = addDays(today, -29);
  const speedByZone = new Map<string, number[]>();
  const allSpeeds: number[] = [];
  for (const o of parcels) {
    if (!DELIVERED.has(o.order_status) || !o.order_status_updated_at || o.order_created_at.slice(0, 10) < since30) continue;
    const days = (Date.parse(o.order_status_updated_at) - Date.parse(o.order_created_at)) / 86_400_000;
    if (!(days >= 0 && days < 30)) continue;
    allSpeeds.push(days);
    const z = zoneOf(Number(o.delivery_fee) || 0);
    speedByZone.set(z, [...(speedByZone.get(z) || []), days]);
  }
  allSpeeds.sort((a, b) => a - b);
  const closed30 = parcels.filter(o => o.order_created_at.slice(0, 10) >= since30 && (DELIVERED.has(o.order_status) || RETURNED.has(o.order_status)));
  const returned30 = closed30.filter(o => RETURNED.has(o.order_status)).length;
  const courier = {
    open: open.length,
    openValue: open.reduce((s, o) => s + (Number(o.order_amount) || 0), 0),
    statuses: [...statusCounts.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    stuck: stuck.slice(0, 25),
    stuckCount: stuck.length,
    speed: {
      median: pct(allSpeeds, 0.5), p90: pct(allSpeeds, 0.9), sample: allSpeeds.length,
      byZone: [...speedByZone.entries()].map(([zone, arr]) => { arr.sort((a, b) => a - b); return { zone, median: pct(arr, 0.5), count: arr.length }; })
        .sort((a, b) => b.count - a.count),
    },
    returnRate30: closed30.length ? (returned30 / closed30.length) * 100 : null,
  };

  // ── 3. volume vs capacity ──
  const placed = volumeRes.status === 'fulfilled' ? volumeRes.value.filter(o => !CANCELLED_WOO.has(o.status)) : [];
  const perDay = new Map<string, number>();
  for (const o of placed) { const d = (o.date_created || '').slice(0, 10); perDay.set(d, (perDay.get(d) || 0) + 1); }
  const days: { date: string; orders: number }[] = [];
  for (let d = addDays(today, -83); d <= today; d = addDays(d, 1)) days.push({ date: d, orders: perDay.get(d) || 0 });
  const weeks: { from: string; orders: number }[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push({ from: days[i].date, orders: days.slice(i, i + 7).reduce((s, x) => s + x.orders, 0) });
  const avg = (arr: { orders: number }[]) => (arr.length ? arr.reduce((s, x) => s + x.orders, 0) / arr.length : 0);
  const last28 = days.slice(-28);
  const prior28 = days.slice(-56, -28);
  const weekday = Array.from({ length: 7 }, (_, i) => ({ day: i, orders: 0, n: 0 }));
  for (const d of days.slice(-56)) { const w = new Date(`${d.date}T00:00:00Z`).getUTCDay(); weekday[w].orders += d.orders; weekday[w].n++; }
  const peak = days.reduce((m, d) => (d.orders > m.orders ? d : m), { date: '', orders: 0 });
  const volume = {
    weeks,
    last7PerDay: avg(days.slice(-7)),
    last28PerDay: avg(last28),
    growth: avg(prior28) > 0 ? (avg(last28) / avg(prior28) - 1) * 100 : null,
    weekday: weekday.map(w => ({ day: w.day, avg: w.n ? w.orders / w.n : 0 })),
    peak,
  };

  // ── 4. restock plan ──
  let restock: any[] = [];
  let stockTotals = null;
  if (stockRes.status === 'fulfilled') {
    const st = stockRes.value;
    stockTotals = st.totals;
    const horizon = settings.leadTimeDays + 30; // cover the production lead time plus a month of selling
    restock = st.products.filter(p => p.sold30 >= 2).map(p => {
      const daily = p.sold30 / 30;
      // Sizes that are out or will be before new stock lands
      const sizes = p.variants.filter(v => v.sold30 > 0 && (v.coverDays ?? Infinity) < settings.leadTimeDays)
        .map(v => ({ size: v.size, stock: v.stock, sold30: v.sold30, reorder: Math.max(0, Math.ceil((v.sold30 / 30) * horizon - v.stock)) }));
      // Spare stock in other sizes can't fill a sold-out size, so never suggest fewer than the size gaps add up to
      const need = Math.max(Math.ceil(daily * horizon - p.stock), sizes.reduce((s, v) => s + v.reorder, 0), 0);
      return {
        id: p.id, name: p.name, stock: p.stock, sold30: p.sold30, coverDays: p.coverDays, reorder: need, reorderCost: need * p.unitCost,
        sizes,
        urgency: p.coverDays == null ? 'ok' : p.coverDays < settings.leadTimeDays ? 'now' : p.coverDays < settings.leadTimeDays + 14 ? 'soon' : 'ok',
      };
    }).filter(r => r.urgency !== 'ok' || r.sizes.length).sort((a, b) => (a.coverDays ?? 999) - (b.coverDays ?? 999));
  }

  const count = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' ? r.value.count || 0 : 0);
  const auto = {
    unitCosts: count(costsRes) > 0,
    accounts: count(accountsRes) > 0,
    budgets: count(budgetsRes) > 0,
  };

  const body = { asOf: new Date().toISOString(), fulfilment, courier, volume, restock, stockTotals, auto, errors };
  if (!Object.keys(errors).length) dashboardCache.set('ops_v1', body, 5 * 60 * 1000);
  return NextResponse.json({ ...body, settings });
}

/** Save an ops setting (capacity, lead time, SLA, checklist). */
export async function PUT(req: NextRequest) {
  try {
    const { key, value } = await req.json();
    if (!SETTING_KEYS.includes(key)) return NextResponse.json({ error: 'Unknown setting' }, { status: 400 });
    if (key === 'ops_checklist') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return NextResponse.json({ error: 'checklist must be an object' }, { status: 400 });
      for (const v of Object.values(value)) if (typeof v !== 'boolean') return NextResponse.json({ error: 'checklist values must be true/false' }, { status: 400 });
    } else if (value !== null && !(typeof value === 'number' && value > 0 && value < 100_000)) {
      return NextResponse.json({ error: 'Enter a positive number' }, { status: 400 });
    }
    const { error } = await supabase.from('fin_settings').upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not save' }, { status: 500 });
  }
}
