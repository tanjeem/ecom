import { NextRequest, NextResponse } from 'next/server';
import { getPathaoPortalOrders } from '@/lib/integrations/pathao';
import { buildFinanceSummary } from '@/lib/finance/summary';
import { addDays, daysBetween } from '@/lib/finance/periods';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DELIVERED = new Set(['Delivered', 'Partial Delivery']);
const RETURNED = new Set(['Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit', 'Paid Return']);

/** 01XXXXXXXXX form, so +880 / 880 / spaces don't split one customer into several */
const normPhone = (p: string) => {
  const d = (p || '').replace(/\D/g, '');
  const local = d.startsWith('880') ? `0${d.slice(3)}` : d.length === 10 && d.startsWith('1') ? `0${d}` : d;
  return /^01\d{9}$/.test(local) ? local : '';
};

type Customer = {
  phone: string; name: string; orders: { date: string; amount: number }[]; returns: number; revenue: number;
};

/**
 * Customer value from Pathao parcels, matched by phone number: who buys again,
 * what a customer is worth over time, and what it costs to win one.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ error: 'from/to must be YYYY-MM-DD with from ≤ to' }, { status: 400 });
  }
  try {
    const [all, summary] = await Promise.all([
      getPathaoPortalOrders(),
      buildFinanceSummary({ from, to, granularity: 'month' }),
    ]);

    const customers = new Map<string, Customer>();
    let withPhone = 0;
    let parcels = 0;
    for (const o of all) {
      if (o.order_type === 'Return' || /^R[SE]/.test(o.order_consignment_id || '')) continue;
      const delivered = DELIVERED.has(o.order_status);
      const returned = RETURNED.has(o.order_status);
      if (!delivered && !returned) continue;
      parcels++;
      const phone = normPhone(o.recipient_phone);
      if (!phone) continue;
      withPhone++;
      if (/shingara/i.test(o.recipient_name || '')) continue; // our own test / exchange parcels
      const c = customers.get(phone) || { phone, name: o.recipient_name || '', orders: [], returns: 0, revenue: 0 };
      if (delivered) {
        const amount = Number(o.order_amount) || 0;
        c.orders.push({ date: o.order_created_at.slice(0, 10), amount });
        c.revenue += amount;
      } else c.returns++;
      if (o.recipient_name) c.name = o.recipient_name;
      customers.set(phone, c);
    }

    const buyers = [...customers.values()].filter(c => c.orders.length > 0);
    for (const c of buyers) c.orders.sort((a, b) => a.date.localeCompare(b.date));

    // ── this period ──
    let active = 0;
    let newCustomers = 0;
    let returning = 0;
    let periodRevenue = 0;
    let periodOrders = 0;
    let newRevenue = 0;
    for (const c of buyers) {
      const inRange = c.orders.filter(o => o.date >= from && o.date <= to);
      if (!inRange.length) continue;
      active++;
      const rev = inRange.reduce((s, o) => s + o.amount, 0);
      periodRevenue += rev;
      periodOrders += inRange.length;
      if (c.orders[0].date >= from) { newCustomers++; newRevenue += rev; } else returning++;
    }

    // ── lifetime ──
    const repeaters = buyers.filter(c => c.orders.length >= 2);
    const lifetimeRevenue = buyers.reduce((s, c) => s + c.revenue, 0);
    const gaps: number[] = [];
    for (const c of repeaters) for (let i = 1; i < c.orders.length; i++) gaps.push(daysBetween(c.orders[i - 1].date, c.orders[i].date) - 1);
    gaps.sort((a, b) => a - b);
    const today = to < new Date().toISOString().slice(0, 10) ? to : new Date().toISOString().slice(0, 10);

    const segments = {
      oneTime: buyers.filter(c => c.orders.length === 1).length,
      repeat: buyers.filter(c => c.orders.length >= 2 && c.orders.length <= 3).length,
      loyal: buyers.filter(c => c.orders.length >= 4).length,
      // Bought more than once, but nothing for 90+ days
      atRisk: repeaters.filter(c => c.orders.at(-1)!.date < addDays(today, -90)).length,
    };

    // ── cohorts by first-order month (last 12) ──
    const cohortMap = new Map<string, { month: string; size: number; again30: number; again90: number; repeat: number; revenue: number }>();
    for (const c of buyers) {
      const month = c.orders[0].date.slice(0, 7);
      const k = cohortMap.get(month) || { month, size: 0, again30: 0, again90: 0, repeat: 0, revenue: 0 };
      k.size++;
      k.revenue += c.revenue;
      const second = c.orders[1]?.date;
      if (second) {
        k.repeat++;
        const gap = daysBetween(c.orders[0].date, second) - 1;
        if (gap <= 30) k.again30++;
        if (gap <= 90) k.again90++;
      }
      cohortMap.set(month, k);
    }
    const cohorts = [...cohortMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map(k => ({
      ...k,
      // A cohort younger than the window can't have hit it yet
      mature30: addDays(`${k.month}-28`, 30) <= today,
      mature90: addDays(`${k.month}-28`, 90) <= today,
      revenuePerCustomer: k.size ? k.revenue / k.size : 0,
    }));

    const adSpend = summary.pl.opex.ads_meta + summary.pl.opex.ads_google;
    const avgLtv = buyers.length ? lifetimeRevenue / buyers.length : 0;
    const gm = summary.pl.gross_margin / 100;

    return NextResponse.json({
      coverage: { parcels, withPhone, share: parcels ? withPhone / parcels : 0 },
      period: {
        active, newCustomers, returning, revenue: periodRevenue, orders: periodOrders,
        revenuePerCustomer: active ? periodRevenue / active : 0,
        newRevenue,
        adSpend,
        cac: newCustomers && adSpend ? adSpend / newCustomers : null,
        grossMargin: summary.pl.gross_margin,
      },
      lifetime: {
        customers: buyers.length,
        repeatRate: buyers.length ? (repeaters.length / buyers.length) * 100 : 0,
        ordersPerCustomer: buyers.length ? buyers.reduce((s, c) => s + c.orders.length, 0) / buyers.length : 0,
        avgLtv,
        avgLtvProfit: gm > 0 ? avgLtv * gm : null,
        medianDaysBetween: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null,
      },
      segments,
      cohorts,
      top: buyers.sort((a, b) => b.revenue - a.revenue).slice(0, 15).map(c => ({
        name: c.name, phone: c.phone, orders: c.orders.length, revenue: c.revenue, returns: c.returns,
        first: c.orders[0].date, last: c.orders.at(-1)!.date,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not load customers' }, { status: 500 });
  }
}
