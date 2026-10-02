import { NextRequest, NextResponse } from 'next/server';
import { getAllWooOrders } from '@/lib/integrations/woocommerce';
import { pathaoFetch, getPathaoPortalOrders, getPathaoInvoices } from '@/lib/integrations/pathao';
import { fetchMetaCampaignInsights } from '@/lib/integrations/meta';
import { metaUsdToBdt } from '@/lib/finance/types';
import type { CommerceOrder, OrderStatus } from '@/lib/types/commerce';
import { ORDER_STATUSES, STATUS_WOO_SLUGS } from '@/lib/orderStatus';
import { dashboardCache } from '@/lib/cache';

// Dashboard for any date range (from/to, inclusive, YYYY-MM-DD) with an
// optional comparison range (cfrom/cto). "Sales" here means orders placed,
// excluding cancelled/failed/refunded — Finance's revenue is cash collected.

const CACHE_TTL = 5 * 60 * 1000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ALL_SLUGS = ORDER_STATUSES.flatMap((s) => STATUS_WOO_SLUGS[s]).join(',');

const DELIVERED = new Set(['Delivered', 'Partial Delivery']);
const RETURNED = new Set(['Return', 'Paid Return', 'Returned To Merchant', 'Returned to Merchant', 'Return In Transit', 'Delivery Failed']);
const NOT_SHIPPED = new Set(['Pickup Cancel', 'Pickup Cancelled', 'Pickup Failed']);

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 4000; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Orders placed in [from, to]. `full` adds line items and meta (needed for products and packed status). */
function fetchOrders(from: string, to: string, full: boolean) {
  return getAllWooOrders(new URLSearchParams({
    status: ALL_SLUGS,
    after: `${from}T00:00:00`,
    before: `${addDays(to, 1)}T00:00:00`,
    _fields: full ? 'id,number,status,total,date_created,line_items,fee_lines,meta_data' : 'id,status,total,date_created',
  }));
}

function salesSummary(orders: CommerceOrder[], from: string, to: string) {
  const sold = orders.filter((o) => o.status !== 'returned');
  const revenue = sold.reduce((s, o) => s + (o.total || 0), 0);
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of sold) {
    const day = (o.dateCreated || '').slice(0, 10);
    const b = byDay.get(day) ?? { revenue: 0, orders: 0 };
    b.revenue += o.total || 0;
    b.orders++;
    byDay.set(day, b);
  }
  return {
    totals: {
      revenue,
      orders: sold.length,
      aov: sold.length ? revenue / sold.length : 0,
      cancelled: orders.length - sold.length,
    },
    daily: datesBetween(from, to).map((date) => ({ date, ...(byDay.get(date) ?? { revenue: 0, orders: 0 }) })),
  };
}

/** Product name without the trailing size/variant ("Black | Zipper Jacket - XL" → "Black | Zipper Jacket"). */
const baseProduct = (name: string) => name.replace(/\s+-\s+[^-]+$/, '').trim() || name;

function topProducts(orders: CommerceOrder[]) {
  const map = new Map<string, { name: string; units: number; revenue: number; orders: number }>();
  for (const o of orders) {
    if (o.status === 'returned') continue;
    const seen = new Set<string>();
    for (const li of o.lineItems ?? []) {
      const name = baseProduct(li.name);
      const p = map.get(name) ?? { name, units: 0, revenue: 0, orders: 0 };
      p.units += li.quantity;
      p.revenue += li.total;
      if (!seen.has(name)) { p.orders++; seen.add(name); }
      map.set(name, p);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
}

/** Inside Dhaka by address (English or Bengali); Pathao's Dhaka rate (≤ ৳80) as a fallback. */
const isDhaka = (address: string, deliveryFee: number) =>
  /dhaka|ঢাকা/i.test(address || '') || (!address && deliveryFee > 0 && deliveryFee <= 80);

const hoursBetween = (a: string, b: string) => {
  const t = (Date.parse(b.replace(' ', 'T')) - Date.parse(a.replace(' ', 'T'))) / 3_600_000;
  return Number.isFinite(t) && t >= 0 && t < 24 * 60 ? t : null;
};

async function courierSummary(from: string, to: string) {
  const all = await getPathaoPortalOrders();
  const inRange = all.filter((o) => {
    const d = o.order_created_at?.slice(0, 10);
    return d >= from && d <= to && o.order_type !== 'Return';
  });
  const out = { delivered: { count: 0, amount: 0 }, inTransit: { count: 0, amount: 0 }, returned: { count: 0, amount: 0 } };
  const region = {
    inside: { delivered: 0, returned: 0, amount: 0 },
    outside: { delivered: 0, returned: 0, amount: 0 },
  };
  let fees = 0;
  const deliveryHours: number[] = [];
  for (const o of inRange) {
    const amount = o.order_amount || 0;
    const r = isDhaka(o.recipient_address, o.delivery_fee) ? region.inside : region.outside;
    if (DELIVERED.has(o.order_status)) {
      out.delivered.count++; out.delivered.amount += amount;
      r.delivered++; r.amount += amount;
      fees += o.total_fee || 0;
      const h = o.order_status_updated_at ? hoursBetween(o.order_created_at, o.order_status_updated_at) : null;
      if (h != null) deliveryHours.push(h);
    } else if (RETURNED.has(o.order_status)) {
      out.returned.count++; out.returned.amount += amount;
      r.returned++;
      fees += o.total_fee || 0;
    } else if (!NOT_SHIPPED.has(o.order_status)) {
      out.inTransit.count++; out.inTransit.amount += amount;
    }
  }
  const closed = out.delivered.count + out.returned.count;
  deliveryHours.sort((a, b) => a - b);
  const rate = (g: { delivered: number; returned: number }) =>
    g.delivered + g.returned > 0 ? (g.returned / (g.delivered + g.returned)) * 100 : null;
  return {
    ...out,
    returnRate: closed > 0 ? (out.returned.count / closed) * 100 : null,
    fees,
    // Median, so a few parcels stuck for weeks don't skew it
    medianDeliveryDays: deliveryHours.length ? deliveryHours[Math.floor(deliveryHours.length / 2)] / 24 : null,
    regions: {
      inside: { ...region.inside, returnRate: rate(region.inside) },
      outside: { ...region.outside, returnRate: rate(region.outside) },
    },
  };
}

/** Open orders across the store (not just this period), grouped by how long they've waited. */
async function dispatchBacklog() {
  const open = await getAllWooOrders(new URLSearchParams({
    status: 'processing,pending,packed,on-hold',
    _fields: 'id,number,status,total,date_created,meta_data',
  }));
  const now = Date.now();
  const buckets = { today: 0, oneToTwo: 0, threePlus: 0 };
  let oldest: { id: string; days: number } | null = null;
  for (const o of open) {
    const days = (now - Date.parse(o.dateCreated || '')) / 86_400_000;
    if (!Number.isFinite(days)) continue;
    if (days < 1) buckets.today++;
    else if (days < 3) buckets.oneToTwo++;
    else buckets.threePlus++;
    if (!oldest || days > oldest.days) oldest = { id: o.id, days };
  }
  return { total: open.length, ...buckets, oldest, value: open.reduce((s, o) => s + (o.total || 0), 0) };
}

/** Orders by weekday (0 = Sunday) and hour of day, in store time. */
function orderTiming(orders: CommerceOrder[]) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const o of orders) {
    if (o.status === 'returned' || !o.dateCreated) continue;
    const [date, time = '00'] = o.dateCreated.split('T');
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    const hour = Number(time.slice(0, 2));
    if (Number.isFinite(day) && hour >= 0 && hour < 24) grid[day][hour]++;
  }
  return grid;
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

/** Units sold per size, from the trailing "- S/M/L…" on line item names. */
function sizeMix(orders: CommerceOrder[]) {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'returned') continue;
    for (const li of o.lineItems ?? []) {
      const m = li.name.match(/\s-\s*([A-Za-z0-9]{1,4})\s*$/);
      const size = m ? m[1].toUpperCase() : 'Other';
      map.set(size, (map.get(size) ?? 0) + li.quantity);
    }
  }
  const rank = (s: string) => (SIZE_ORDER.includes(s) ? SIZE_ORDER.indexOf(s) : s === 'Other' ? 99 : 50);
  return [...map.entries()].map(([size, units]) => ({ size, units })).sort((a, b) => rank(a.size) - rank(b.size));
}

async function adSpend(from: string, to: string) {
  const data = await fetchMetaCampaignInsights('custom', from, to);
  // The Meta helper substitutes "[Mock]" campaigns when the API fails — never show those as real spend
  if (data.campaigns.some((c) => c.name.includes('[Mock]'))) return null;
  return metaUsdToBdt(data.campaigns.reduce((s, c) => s + c.spend, 0));
}

type InvoiceSummary = {
  last_invoice_date: string;
  payment_sent: number;
  payment_method_name: string;
  lifetime_earning: number;
  payment_in_process: number;
  payment_in_review: number;
  payment_preparing_for_invoice: number;
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const cfrom = sp.get('cfrom') ?? '';
  const cto = sp.get('cto') ?? '';
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ error: 'from and to must be YYYY-MM-DD dates' }, { status: 400 });
  }
  const hasCompare = ISO.test(cfrom) && ISO.test(cto) && cfrom <= cto;

  const cacheKey = `dashboard_v2_${from}_${to}_${hasCompare ? `${cfrom}_${cto}` : ''}`;
  if (sp.get('refresh') !== 'true') {
    const cached = dashboardCache.get<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);
  }

  const [cur, prev, courier, prevCourier, spend, prevSpend, summary, invoices, backlog] = await Promise.allSettled([
    fetchOrders(from, to, true),
    hasCompare ? fetchOrders(cfrom, cto, false) : Promise.resolve(null),
    courierSummary(from, to),
    hasCompare ? courierSummary(cfrom, cto) : Promise.resolve(null),
    adSpend(from, to),
    hasCompare ? adSpend(cfrom, cto) : Promise.resolve(null),
    pathaoFetch<{ data: InvoiceSummary }>('/merchant/invoice-summary'),
    getPathaoInvoices(addDays(from, -7)),
    dispatchBacklog(),
  ]);

  const value = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);
  const failed = (r: PromiseSettledResult<unknown>) => (r.status === 'rejected' ? String(r.reason) : null);

  const orders = value(cur) ?? [];
  const sales = salesSummary(orders, from, to);
  const prevOrders = value(prev);
  const prevSales = prevOrders ? salesSummary(prevOrders, cfrom, cto) : null;

  const pipeline = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const o of orders) pipeline[o.status]++;

  const inv = value(summary)?.data ?? null;
  const paid = (value(invoices) ?? []).filter((i) => {
    const d = (i.paid_at ?? '').slice(0, 10);
    return i.payment_status === 'paid' && d >= from && d <= to;
  });

  const body = {
    range: { from, to },
    compare: hasCompare ? { from: cfrom, to: cto } : null,
    sales: sales.totals,
    prevSales: prevSales?.totals ?? null,
    daily: sales.daily,
    prevDaily: prevSales?.daily ?? null,
    pipeline,
    courier: value(courier),
    prevCourier: value(prevCourier),
    adSpend: value(spend),
    prevAdSpend: value(prevSpend),
    topProducts: topProducts(orders),
    sizes: sizeMix(orders),
    timing: orderTiming(orders),
    backlog: value(backlog),
    payouts: {
      paidInPeriod: paid.reduce((s, i) => s + (i.payable_amount || 0), 0),
      payoutCount: paid.length,
      inReview: inv?.payment_in_review ?? 0,
      preparing: inv?.payment_preparing_for_invoice ?? 0,
      inProcess: inv?.payment_in_process ?? 0,
      lastPayout: inv ? { amount: inv.payment_sent, date: inv.last_invoice_date, method: inv.payment_method_name } : null,
      lifetime: inv?.lifetime_earning ?? null,
    },
    errors: {
      orders: failed(cur),
      courier: failed(courier),
      ads: spend.status === 'fulfilled' && spend.value == null ? 'Meta Ads unavailable' : failed(spend),
      payouts: failed(summary) ?? failed(invoices),
    },
  };

  // Only cache complete answers, so a transient failure doesn't stick for 5 minutes
  if (cur.status === 'fulfilled' && courier.status === 'fulfilled' && summary.status === 'fulfilled') {
    dashboardCache.set(cacheKey, body, CACHE_TTL);
  }
  return NextResponse.json(body);
}
