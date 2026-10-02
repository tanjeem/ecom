import { NextRequest, NextResponse } from 'next/server';
import { getPathaoPortalOrders, type PathaoPortalOrder } from '@/lib/integrations/pathao';
import { lineItemsFor } from '@/lib/finance/products';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DELIVERED = new Set(['Delivered', 'Partial Delivery']);
const RETURNED = new Set(['Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit', 'Paid Return']);

// Pathao prices by zone, so the delivery fee is a reliable zone signal even
// when the free-text address is messy.
const zoneOf = (fee: number) => (fee <= 0 ? 'Unknown' : fee <= 80 ? 'Inside Dhaka' : fee <= 110 ? 'Dhaka suburbs' : 'Outside Dhaka');

// Dhaka neighbourhoods first (more specific), then districts
const AREAS = [
  'Mirpur', 'Uttara', 'Dhanmondi', 'Mohammadpur', 'Gulshan', 'Banani', 'Baridhara', 'Bashundhara', 'Badda', 'Rampura',
  'Khilgaon', 'Malibagh', 'Mogbazar', 'Motijheel', 'Jatrabari', 'Demra', 'Shyamoli', 'Farmgate', 'Tejgaon', 'Lalbagh',
  'Old Dhaka', 'Wari', 'Khilkhet', 'Mohakhali', 'Pallabi', 'Cantonment', 'Kafrul', 'Adabor', 'Hazaribagh', 'Kamrangirchar',
  'Keraniganj', 'Savar', 'Ashulia', 'Tongi', 'Gazipur', 'Narayanganj', 'Narsingdi', 'Munshiganj', 'Manikganj',
  'Chattogram', 'Chittagong', 'Cumilla', 'Comilla', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal', 'Barisal', 'Rangpur',
  'Mymensingh', 'Bogura', 'Bogra', 'Cox', 'Feni', 'Noakhali', 'Brahmanbaria', 'Chandpur', 'Lakshmipur', 'Jessore',
  'Jashore', 'Kushtia', 'Pabna', 'Sirajganj', 'Tangail', 'Jamalpur', 'Sherpur', 'Netrokona', 'Kishoreganj', 'Habiganj',
  'Moulvibazar', 'Sunamganj', 'Dinajpur', 'Thakurgaon', 'Panchagarh', 'Nilphamari', 'Lalmonirhat', 'Kurigram',
  'Gaibandha', 'Joypurhat', 'Naogaon', 'Natore', 'Chapainawabganj', 'Faridpur', 'Gopalganj', 'Madaripur', 'Shariatpur',
  'Rajbari', 'Patuakhali', 'Bhola', 'Pirojpur', 'Jhalokathi', 'Barguna', 'Satkhira', 'Bagerhat', 'Narail', 'Magura',
  'Jhenaidah', 'Chuadanga', 'Meherpur', 'Bandarban', 'Rangamati', 'Khagrachari',
];
const ALIASES: Record<string, string> = { Chittagong: 'Chattogram', Comilla: 'Cumilla', Barisal: 'Barishal', Bogra: 'Bogura', Jessore: 'Jashore', Cox: "Cox's Bazar" };
const AREA_RE = AREAS.map(a => [a, new RegExp(`\\b${a}`, 'i')] as const);

const areaOf = (address: string) => {
  for (const [name, re] of AREA_RE) if (re.test(address)) return ALIASES[name] || name;
  return /dhaka/i.test(address) ? 'Dhaka (other)' : 'Unknown';
};

const valueBand = (v: number) => (v < 1000 ? '< ৳1,000' : v < 2000 ? '৳1,000–1,999' : v < 3000 ? '৳2,000–2,999' : '৳3,000+');
const BAND_ORDER = ['< ৳1,000', '৳1,000–1,999', '৳2,000–2,999', '৳3,000+'];

type Agg = { key: string; delivered: number; returned: number; returnFees: number; lostValue: number };
const bump = (m: Map<string, Agg>, key: string, isReturn: boolean, fee: number, value: number) => {
  const a = m.get(key) || { key, delivered: 0, returned: 0, returnFees: 0, lostValue: 0 };
  if (isReturn) { a.returned++; a.returnFees += fee; a.lostValue += value; } else a.delivered++;
  m.set(key, a);
};
const finish = (m: Map<string, Agg>, minOrders = 0) => [...m.values()]
  .map(a => ({ ...a, orders: a.delivered + a.returned, rate: a.delivered + a.returned ? (a.returned / (a.delivered + a.returned)) * 100 : 0 }))
  .filter(a => a.orders >= minOrders);

/** Return analysis for Pathao orders created in [from, to]. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ error: 'from/to must be YYYY-MM-DD with from ≤ to' }, { status: 400 });
  }

  try {
    const all = await getPathaoPortalOrders();
    const orders = all.filter((o: PathaoPortalOrder) => {
      const d = o.order_created_at?.slice(0, 10);
      // Reverse consignments (the parcel coming back to the shop) are recorded as their own
      // "Return"-type orders; counting them would double every return.
      if (o.order_type === 'Return' || o.order_type === 'Reverse Delivery' || /^R[SE]/.test(o.order_consignment_id || '')) return false;
      return d && d >= from && d <= to && (DELIVERED.has(o.order_status) || RETURNED.has(o.order_status));
    });

    const items = await lineItemsFor(orders.map(o => o.merchant_order_id).filter(id => id && /^\d+$/.test(id)));

    const byMonth = new Map<string, Agg>();
    const byZone = new Map<string, Agg>();
    const byArea = new Map<string, Agg>();
    const byProduct = new Map<string, Agg>();
    const byBand = new Map<string, Agg>();
    const customers = new Map<string, { phone: string; name: string; delivered: number; returned: number; returnFees: number; lastReturn: string }>();
    let returnFees = 0;
    let lostValue = 0;
    let returned = 0;

    for (const o of orders) {
      const isReturn = RETURNED.has(o.order_status);
      const fee = Number(o.total_fee) || Number(o.delivery_fee) || 0;
      const value = Number(o.order_amount) || 0;
      if (isReturn) { returned++; returnFees += fee; lostValue += value; }

      bump(byMonth, o.order_created_at.slice(0, 7), isReturn, fee, value);
      bump(byZone, zoneOf(Number(o.delivery_fee) || 0), isReturn, fee, value);
      bump(byArea, o.recipient_address ? areaOf(o.recipient_address) : 'Unknown', isReturn, fee, value);
      bump(byBand, valueBand(value), isReturn, fee, value);

      const li = o.merchant_order_id ? items.get(o.merchant_order_id) : undefined;
      const names = li?.length
        ? [...new Set(li.map(x => x.name.replace(/\s+-\s+(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|\d{2})$/i, '').trim()))]
        : o.order_description ? [o.order_description.trim().slice(0, 60)] : [];
      for (const n of names) bump(byProduct, n, isReturn, fee / names.length, value / names.length);

      const phone = (o.recipient_phone || '').replace(/\D/g, '').slice(-11);
      // Parcels addressed to the shop itself are internal moves, not customers
      if (phone.length >= 10 && !/shingara/i.test(o.recipient_name || '')) {
        const c = customers.get(phone) || { phone, name: o.recipient_name || '', delivered: 0, returned: 0, returnFees: 0, lastReturn: '' };
        if (isReturn) {
          c.returned++; c.returnFees += fee;
          if (o.order_created_at > c.lastReturn) c.lastReturn = o.order_created_at.slice(0, 10);
        } else c.delivered++;
        customers.set(phone, c);
      }
    }

    const closed = orders.length;
    return NextResponse.json({
      range: { from, to },
      totals: { orders: closed, returned, delivered: closed - returned, rate: closed ? (returned / closed) * 100 : 0, returnFees, lostValue },
      byMonth: finish(byMonth).sort((a, b) => a.key.localeCompare(b.key)),
      byZone: finish(byZone).sort((a, b) => b.orders - a.orders),
      byArea: finish(byArea, 5).sort((a, b) => b.returned - a.returned).slice(0, 15),
      byProduct: finish(byProduct, 5).sort((a, b) => b.returned - a.returned).slice(0, 15),
      byValue: finish(byBand).sort((a, b) => BAND_ORDER.indexOf(a.key) - BAND_ORDER.indexOf(b.key)),
      repeatReturners: [...customers.values()]
        .filter(c => c.returned >= 2)
        .map(c => ({ ...c, rate: (c.returned / (c.returned + c.delivered)) * 100 }))
        .sort((a, b) => b.returned - a.returned || b.rate - a.rate)
        .slice(0, 20),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to analyse returns' }, { status: 500 });
  }
}
