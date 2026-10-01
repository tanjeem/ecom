import type { CommerceOrder } from "@/lib/types/commerce";
import { hasEnv, requiredPathaoEnv } from "./env";
import { getWooOrdersInRange } from "./woocommerce";
import fs from 'fs';
import path from 'path';

type PathaoTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  message?: string;
};

export type PathaoPortalOrder = {
  order_consignment_id: string;
  order_created_at: string;
  order_description: string;
  merchant_order_id: string;
  recipient_name: string;
  recipient_address: string;
  recipient_phone: string;
  order_amount: number;
  total_fee: number;
  delivery_fee: number;
  order_status: string;
  order_status_updated_at: string;
  order_type: string;
  item_type: string;
};

/** Login to Pathao merchant portal (different token audience from Aladdin API) */
let _portalToken: string | null = null;
let _portalTokenExpiry = 0;

async function getMerchantPortalToken(): Promise<string> {
  if (_portalToken && Date.now() < _portalTokenExpiry) return _portalToken;
  const res = await fetch("https://merchant.pathao.com/api/v1/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: process.env.PATHAO_USERNAME,
      password: process.env.PATHAO_PASSWORD,
    }),
    cache: "no-store",
  });
  const data = await res.json() as PathaoTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || "Pathao merchant portal login failed");
  }
  _portalToken = data.access_token;
  // Cache for 6 hours (token is valid 90 days but we refresh conservatively)
  _portalTokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return _portalToken;
}

/**
 * Fetch all orders from Pathao merchant portal with date filtering.
 * Uses the /api/v1/orders/all endpoint which is what their own dashboard uses.
 * from_date / to_date format: YYYY-MM-DD
 */
let _allOrdersCache: PathaoPortalOrder[] | null = null;
let _allOrdersCacheExpiry = 0;
const ALL_ORDERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Parse a whole CSV document. Handles quoted fields containing commas, escaped quotes and line breaks (Pathao addresses often span lines). */
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') i++;
      row.push(field.trim());
      field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

/**
 * Every Pathao portal export saved as lib/data/archived_orders*.csv. Later
 * files win when a consignment appears in more than one export.
 */
function loadArchivedOrders(): PathaoPortalOrder[] {
  const dir = path.join(process.cwd(), 'lib/data');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => /^archived_orders.*\.csv$/.test(f)).sort()
    : [];
  if (files.length === 0) console.warn('[Pathao] No archived orders CSV found in', dir);

  const byConsignment = new Map<string, PathaoPortalOrder>();
  for (const file of files) {
    for (const o of loadArchiveFile(path.join(dir, file))) {
      byConsignment.set(o.order_consignment_id, o);
    }
  }
  return Array.from(byConsignment.values());
}

function loadArchiveFile(filePath: string): PathaoPortalOrder[] {
  try {
    const rows = parseCSV(fs.readFileSync(filePath, 'utf8'));
    if (rows.length <= 1) return [];

    const headers = rows[0];
    const consignmentIdIdx = headers.indexOf('Order consignment id');
    const createdAtIdx = headers.indexOf('Order created at');
    const descriptionIdx = headers.indexOf('Order description');
    const merchantOrderIdIdx = headers.indexOf('Merchant order id');
    const recipientNameIdx = headers.indexOf('Recipient name');
    const recipientAddressIdx = headers.indexOf('Recipient address');
    const recipientPhoneIdx = headers.indexOf('Recipient phone');
    const statusIdx = headers.indexOf('Order status');
    const statusUpdatedAtIdx = headers.indexOf('Order status updated at');
    const collectableIdx = headers.indexOf('Collectable Amount');
    const collectedIdx = headers.indexOf('Collected amount');
    const totalFeeIdx = headers.indexOf('Total fee');
    const deliveryFeeIdx = headers.indexOf('Delivery fee');
    const orderTypeIdx = headers.indexOf('Order type');
    const itemTypeIdx = headers.indexOf('item_type');

    const orders: PathaoPortalOrder[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const status = row[statusIdx] || '';
      const collectedAmt = parseFloat(row[collectedIdx] || '0');
      const collectableAmt = parseFloat(row[collectableIdx] || '0');
      
      // If delivered, use collected amount. Otherwise fallback to collectable amount
      const amount = status.startsWith('Delivered') || status === 'Partial Delivery'
        ? (collectedAmt || collectableAmt)
        : collectableAmt;

      const merchant_order_id = row[merchantOrderIdIdx]
        ? row[merchantOrderIdIdx].replace(/^"+|"+$/g, '')
        : '';

      orders.push({
        order_consignment_id: row[consignmentIdIdx] || '',
        order_created_at: row[createdAtIdx] || '',
        order_description: row[descriptionIdx] || '',
        merchant_order_id,
        recipient_name: row[recipientNameIdx] || '',
        recipient_address: row[recipientAddressIdx] || '',
        recipient_phone: row[recipientPhoneIdx] || '',
        order_amount: amount,
        total_fee: parseFloat(row[totalFeeIdx] || '0'),
        delivery_fee: parseFloat(row[deliveryFeeIdx] || '0'),
        order_status: status,
        order_status_updated_at: row[statusUpdatedAtIdx] || '',
        order_type: row[orderTypeIdx] || 'Delivery',
        item_type: row[itemTypeIdx] || 'Parcel',
      });
    }
    return orders;
  } catch (error) {
    console.error('[Pathao] Failed to load archived orders from CSV:', error);
    return [];
  }
}

let _archiveCache: { orders: PathaoPortalOrder[]; lastDate: string } | null = null;

/** Archived CSV is static for the life of the process — parse it once. */
function getArchive() {
  if (!_archiveCache) {
    const orders = loadArchivedOrders();
    const lastDate = orders.reduce((max, o) => {
      const d = o.order_created_at.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(d) && d > max ? d : max;
    }, '');
    _archiveCache = { orders, lastDate };
  }
  return _archiveCache;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Pages through the merchant portal's order list. Throws on auth/API failure instead of returning a silent partial. */
async function fetchLivePortalOrders(fromDate: string, toDate?: string): Promise<{ orders: PathaoPortalOrder[]; complete: boolean }> {
  const token = await getMerchantPortalToken();
  const orders: PathaoPortalOrder[] = [];
  let page = 1;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (true) {
    const params = new URLSearchParams({ per_page: '100', page: String(page), from_date: fromDate });
    if (toDate) params.set('to_date', toDate);

    const res = await fetch(`https://merchant.pathao.com/api/v1/orders/all?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        console.warn(`[Pathao] Rate limit exceeded after ${MAX_RETRIES} retries. Returning partial live orders.`);
        return { orders, complete: false };
      }
      retryCount++;
      await new Promise(r => setTimeout(r, 2000 * retryCount));
      continue;
    }
    if (!res.ok) throw new Error(`Pathao portal orders request failed with ${res.status}`);
    retryCount = 0;

    const json = await res.json() as {
      data?: { data: PathaoPortalOrder[]; last_page: number };
    };
    const rows = json.data?.data ?? [];
    orders.push(...rows);
    if (page >= (json.data?.last_page ?? 1) || rows.length === 0) break;
    page++;
    await new Promise(r => setTimeout(r, 300));
  }
  return { orders, complete: true };
}

/**
 * Pathao's portal only returns roughly the last few months of orders — older
 * ones are purged (even /orders/{id}/info 404s). The live feed may still carry
 * a few stragglers from before that, so coverage starts after the last gap
 * of more than 14 days between consecutive live orders.
 */
function liveCoverageStart(live: PathaoPortalOrder[]): string | null {
  const dates = live
    .map(o => o.order_created_at?.slice(0, 10))
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  let start = dates[dates.length - 1];
  for (let i = dates.length - 1; i > 0; i--) {
    const gapDays = (Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86_400_000;
    if (gapDays > 14) break;
    start = dates[i - 1];
  }
  return start;
}

const WOO_DELIVERED_TRACKING = new Set(['Delivered', 'Partial Delivery']);
const WOO_RETURN_TRACKING = new Set(['Return', 'Paid Return', 'Returned To Merchant', 'Returned to Merchant', 'Return In Transit']);

/**
 * Rebuild orders for a window Pathao no longer has, from WooCommerce plus the
 * Pathao status our webhook wrote back onto each order. Orders that were
 * shipped but never got a final tracking status are counted as delivered and
 * marked `order_type: 'Estimated'`.
 */
async function reconstructFromWoo(from: string, toExclusive: string, known: Set<string>): Promise<PathaoPortalOrder[]> {
  const wooOrders = await getWooOrdersInRange(from, toExclusive);
  const result: PathaoPortalOrder[] = [];

  for (const o of wooOrders) {
    const meta = Object.fromEntries((o.meta_data ?? []).map(m => [m.key, String(m.value ?? '')]));
    const consignmentId = meta.ptc_consignment_id || meta.pathao_consignment_id || '';
    if ((consignmentId && known.has(consignmentId)) || known.has(String(o.id))) continue;

    const tracking = meta.ptc_status || meta.pathao_status || '';
    let status: string;
    let orderType = 'Delivery';
    if (WOO_DELIVERED_TRACKING.has(tracking) || WOO_RETURN_TRACKING.has(tracking)) {
      status = tracking;
    } else if (o.status === 'completed') {
      status = 'Delivered';
    } else if (['processing', 'dispatched', 'packed'].includes(o.status)) {
      status = 'Delivered';
      orderType = 'Estimated';
    } else {
      continue; // cancelled, failed, refunded, on-hold, pending — never revenue
    }

    result.push({
      order_consignment_id: consignmentId || `woo-${o.id}`,
      order_created_at: (o.date_created ?? '').replace('T', ' '),
      order_description: '',
      merchant_order_id: String(o.id),
      recipient_name: '',
      recipient_address: '',
      recipient_phone: '',
      order_amount: Number(o.total) || 0,
      total_fee: 0,
      delivery_fee: Number(meta.ptc_delivery_fee || meta.pathao_delivery_fee || 0),
      order_status: status,
      order_status_updated_at: '',
      order_type: orderType,
      item_type: 'Parcel',
    });
  }
  return result;
}

type InvoiceSnapshot = {
  synced_at: string | null;
  invoices?: Record<string, { created_at: string; paid_at: string | null; payable_amount: number }>;
  orders: Array<{
    payout?: number;
    invoice_id?: string;
    consignment_id: string;
    created_at: string;
    invoice_type: string;
    merchant_order_id: string;
    collectable_amount: number;
    collected_amount: number;
    delivery_fee: number;
    final_fee: number;
  }>;
};

let _invoiceSnapshot: InvoiceSnapshot | null = null;

/** Paid-invoice snapshot written by scripts/sync-pathao-invoices.mjs. */
function loadInvoiceSnapshot(): InvoiceSnapshot {
  if (!_invoiceSnapshot) {
    const filePath = path.join(process.cwd(), 'lib/data/pathao_invoices.json');
    try {
      _invoiceSnapshot = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
        : { synced_at: null, orders: [] };
    } catch (error) {
      console.error('[Pathao] Failed to load invoice snapshot:', error);
      _invoiceSnapshot = { synced_at: null, orders: [] };
    }
  }
  return _invoiceSnapshot!;
}

/**
 * Orders in [from, toExclusive) rebuilt from paid Pathao invoices. Delivery
 * lines carry the cash actually collected; return lines are reverse
 * consignments, matching how the archive CSV records returns.
 * `lastDate` is the newest order date the snapshot knows about.
 */
function ordersFromInvoices(from: string, toExclusive: string, known: Set<string>) {
  const { orders } = loadInvoiceSnapshot();
  const result: PathaoPortalOrder[] = [];
  let lastDate = '';

  for (const d of orders) {
    const date = d.created_at.slice(0, 10);
    if (date > lastDate) lastDate = date;
    if (date < from || date >= toExclusive) continue;
    if (known.has(d.consignment_id) || (d.merchant_order_id && known.has(d.merchant_order_id))) continue;

    const isReturn = d.invoice_type === 'return';
    result.push({
      order_consignment_id: d.consignment_id,
      order_created_at: d.created_at,
      order_description: '',
      merchant_order_id: d.merchant_order_id,
      recipient_name: '',
      recipient_address: '',
      recipient_phone: '',
      order_amount: isReturn ? d.collectable_amount : d.collected_amount,
      total_fee: d.final_fee,
      delivery_fee: d.delivery_fee,
      order_status: isReturn ? 'Returned To Merchant' : 'Delivered',
      order_status_updated_at: '',
      order_type: isReturn ? 'Return' : 'Delivery',
      item_type: 'Parcel',
    });
  }
  return { orders: result, lastDate };
}

let _gapCache: { key: string; orders: PathaoPortalOrder[]; expiry: number } | null = null;
const GAP_CACHE_TTL = 6 * 60 * 60 * 1000; // historical window — rarely changes

let _allOrdersInflight: Promise<PathaoPortalOrder[]> | null = null;
const PARTIAL_CACHE_TTL = 30 * 1000; // retry soon when Pathao rate-limited us

export async function getPathaoPortalOrders(
  fromDate?: string,
  toDate?: string,
): Promise<PathaoPortalOrder[]> {
  if (fromDate || toDate) return loadPortalOrders(fromDate, toDate);

  // No date filter: serve from cache, and let concurrent callers (dashboard
  // widgets load in parallel) share one fetch instead of each paging through
  // Pathao and tripping its rate limit.
  if (_allOrdersCache && Date.now() < _allOrdersCacheExpiry) return _allOrdersCache;
  if (!_allOrdersInflight) {
    _allOrdersInflight = loadPortalOrders().finally(() => { _allOrdersInflight = null; });
  }
  return _allOrdersInflight;
}

async function loadPortalOrders(fromDate?: string, toDate?: string): Promise<PathaoPortalOrder[]> {
  const isDefaultQuery = !fromDate && !toDate;
  if (isDefaultQuery) fromDate = '2025-01-01';

  // Historical orders exported from the Pathao portal
  const archive = getArchive();
  const filteredArchived = archive.orders.filter(o => {
    const d = o.order_created_at.slice(0, 10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });

  const liveFrom = archive.lastDate ? addDays(archive.lastDate, 1) : '2025-01-01';
  const queryEnd = toDate || new Date().toISOString().slice(0, 10);

  let liveOrders: PathaoPortalOrder[] = [];
  let liveComplete = true;
  if (queryEnd >= liveFrom) {
    try {
      ({ orders: liveOrders, complete: liveComplete } =
        await fetchLivePortalOrders(!fromDate || fromDate < liveFrom ? liveFrom : fromDate, toDate));
    } catch (apiError) {
      liveComplete = false;
      console.error('[Pathao] Failed to fetch live orders from API:', apiError);
    }
  }

  const combinedMap = new Map<string, PathaoPortalOrder>();
  for (const o of [...filteredArchived, ...liveOrders]) {
    if (o.order_consignment_id) combinedMap.set(o.order_consignment_id, o);
  }

  // Fill the hole between the archive and what Pathao still serves live:
  // paid invoices first (actual collected cash), then WooCommerce for any
  // stretch after the last synced invoice.
  const coverage = liveOrders.length > 0 ? liveCoverageStart(liveOrders) : queryEnd;
  if (isDefaultQuery && coverage && coverage > liveFrom) {
    const known = new Set<string>();
    for (const o of combinedMap.values()) {
      known.add(o.order_consignment_id);
      if (o.merchant_order_id) known.add(o.merchant_order_id);
    }

    const { orders: invoiceOrders, lastDate: invoicesUntil } = ordersFromInvoices(liveFrom, coverage, known);
    for (const o of invoiceOrders) {
      if (!combinedMap.has(o.order_consignment_id)) combinedMap.set(o.order_consignment_id, o);
    }

    const wooFrom = invoicesUntil ? addDays(invoicesUntil, 1) : liveFrom;
    if (wooFrom < coverage) {
      const key = `${wooFrom}_${coverage}`;
      if (!_gapCache || _gapCache.key !== key || Date.now() > _gapCache.expiry) {
        try {
          _gapCache = { key, orders: await reconstructFromWoo(wooFrom, coverage, known), expiry: Date.now() + GAP_CACHE_TTL };
        } catch (err) {
          console.error('[Pathao] Failed to reconstruct gap orders from WooCommerce:', err);
        }
      }
      for (const o of _gapCache?.orders ?? []) {
        if (!combinedMap.has(o.order_consignment_id)) combinedMap.set(o.order_consignment_id, o);
      }
    }
  }

  const allCombined = Array.from(combinedMap.values());

  if (isDefaultQuery) {
    _allOrdersCache = allCombined;
    _allOrdersCacheExpiry = Date.now() + (liveComplete ? ALL_ORDERS_CACHE_TTL : PARTIAL_CACHE_TTL);
  }

  return allCombined;
}

export type PathaoInvoice = {
  invoice_id: string;
  created_at: string;
  paid_at?: string;
  payable_amount: number;
  payment_status: string;
};

/** Payment invoices created on or after `since` (YYYY-MM-DD), newest first. */
export async function getPathaoInvoices(since: string): Promise<PathaoInvoice[]> {
  const token = await getMerchantPortalToken();
  const invoices: PathaoInvoice[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`https://merchant.pathao.com/api/v1/monetary/invoices/list?page=${page}&limit=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Pathao invoice list failed with ${res.status}`);
    const json = await res.json() as { data?: { data: PathaoInvoice[]; last_page: number } };
    const rows = json.data?.data ?? [];
    invoices.push(...rows.filter(i => i.created_at.slice(0, 10) >= since));
    const reachedOlder = rows.some(i => i.created_at.slice(0, 10) < since);
    if (reachedOlder || rows.length === 0 || page >= (json.data?.last_page ?? 1)) break;
  }
  return invoices;
}

/** One consignment line on a paid Pathao invoice, dated by its invoice. */
export type PathaoInvoiceLine = {
  invoice_id: string;
  invoice_date: string; // YYYY-MM-DD the invoice was raised
  paid_date: string | null;
  consignment_id: string;
  type: 'delivery' | 'return';
  collected: number;
  fee: number;
  payout: number; // collected − fee; lines on an invoice sum to its payable amount
};

let _invoiceLinesCache: { lines: PathaoInvoiceLine[]; expiry: number } | null = null;
let _invoiceLinesInflight: Promise<PathaoInvoiceLine[]> | null = null;

/**
 * Every paid-invoice line: the snapshot from scripts/sync-pathao-invoices.mjs
 * plus any invoices raised since, fetched live (breakdowns are immutable once
 * paid). If Pathao is unreachable, the snapshot alone is returned.
 */
export async function getPathaoInvoiceLines(): Promise<PathaoInvoiceLine[]> {
  if (_invoiceLinesCache && Date.now() < _invoiceLinesCache.expiry) return _invoiceLinesCache.lines;
  if (_invoiceLinesInflight) return _invoiceLinesInflight;

  _invoiceLinesInflight = (async () => {
    const snap = loadInvoiceSnapshot();
    const meta = snap.invoices || {};
    const toLine = (d: any, invoiceId: string, invCreated: string, invPaid: string | null): PathaoInvoiceLine => {
      const type = d.invoice_type === 'return' ? 'return' : 'delivery';
      const collected = type === 'delivery' ? Number(d.collected_amount) || 0 : 0;
      const fee = Number(d.final_fee) || 0;
      return {
        invoice_id: invoiceId, invoice_date: invCreated.slice(0, 10), paid_date: invPaid ? invPaid.slice(0, 10) : null,
        consignment_id: d.consignment_id, type, collected, fee,
        payout: d.payout != null ? Number(d.payout) : collected - fee,
      };
    };

    const lines: PathaoInvoiceLine[] = [];
    for (const d of snap.orders) {
      const inv = d.invoice_id ? meta[d.invoice_id] : undefined;
      if (!inv) continue; // older snapshots without invoice ids can't be dated by invoice
      lines.push(toLine(d, d.invoice_id!, inv.created_at, inv.paid_at));
    }

    let complete = true;
    try {
      const newest = Object.values(meta).reduce((m, i) => (i.created_at > m ? i.created_at : m), '');
      const since = newest ? newest.slice(0, 10) : '2024-01-01';
      const fresh = (await getPathaoInvoices(since)).filter(i => i.payment_status === 'paid' && !meta[i.invoice_id]);
      if (fresh.length) {
        const token = await getMerchantPortalToken();
        for (const inv of fresh) {
          const res = await fetch(`https://merchant.pathao.com/api/v1/monetary/invoices/${inv.invoice_id}/breakdown`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            cache: 'no-store',
          });
          if (!res.ok) { complete = false; continue; }
          const json = await res.json() as { data?: any[] };
          for (const d of json.data ?? []) lines.push(toLine(d, inv.invoice_id, inv.created_at, inv.paid_at ?? null));
        }
      }
    } catch (error) {
      complete = false;
      console.error('[Pathao] Live invoice top-up failed, using snapshot only:', error);
    }

    _invoiceLinesCache = { lines, expiry: Date.now() + (complete ? 30 * 60 * 1000 : PARTIAL_CACHE_TTL) };
    return lines;
  })().finally(() => { _invoiceLinesInflight = null; });

  return _invoiceLinesInflight;
}

type PathaoCreateResponse = {
  message: string;
  type: string;
  code: number;
  data: {
    consignment_id: string;
    merchant_order_id?: string;
    order_status: string;
    delivery_fee: number;
  };
};

type PathaoStoreResponse = {
  message: string;
  type: string;
  code: number;
  data: {
    store_id: number;
    store_name: string;
    store_address: string;
    is_active: number;
    city_id: number;
    zone_id: number;
    hub_id: number;
    is_default_store: boolean;
    is_default_return_store: boolean;
  };
};

function getPathaoBaseURL() {
  const url = process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com";
  return url.replace(/\/$/, "");
}

let _aladdinToken: string | null = null;
let _aladdinTokenExpiry = 0;

async function getPathaoToken(): Promise<string> {
  if (_aladdinToken && Date.now() < _aladdinTokenExpiry) return _aladdinToken;

  if (!hasEnv(requiredPathaoEnv)) {
    throw new Error("Pathao credentials are not configured");
  }

  const body: Record<string, string> = {
    client_id: String(process.env.PATHAO_CLIENT_ID),
    client_secret: String(process.env.PATHAO_CLIENT_SECRET),
    grant_type: "password",
    username: String(process.env.PATHAO_USERNAME),
    password: String(process.env.PATHAO_PASSWORD),
  };

  const response = await fetch(`${getPathaoBaseURL()}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await response.json()) as PathaoTokenResponse;

  if (!response.ok) {
    throw new Error(data.message || `Pathao token request failed with ${response.status}`);
  }
  if (!data.access_token) throw new Error("Pathao token response did not include an access token");

  _aladdinToken = data.access_token;
  // expires_in is in seconds; refresh 5 minutes before expiry
  _aladdinTokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 300) * 1000;
  return _aladdinToken;
}

export async function pathaoFetch<T>(endpoint: string, options: RequestInit = {}) {
  const token = await getPathaoToken();
  const response = await fetch(`${getPathaoBaseURL()}/aladdin/api/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || { charset: "UTF-8" }),
    },
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || `Pathao request failed with ${response.status}`);
  }

  return data as T;
}

// ── Default city resolution (cached) ─────────────────────────────────────────

let _defaultCityId = 0;

/**
 * Returns the merchant's delivery city ID.
 * Priority: PATHAO_DEFAULT_CITY_ID env var → merchant's store city → Dhaka (1)
 */
async function getDefaultCityId(): Promise<number> {
  const envCity = Number(process.env.PATHAO_DEFAULT_CITY_ID || 0);
  if (envCity) return envCity;
  if (_defaultCityId) return _defaultCityId;

  try {
    const { stores } = await getPathaoStores();
    const store = stores.find((s) => s.isDefaultStore) ?? stores[0];
    if (store?.cityId) { _defaultCityId = store.cityId; return _defaultCityId; }
  } catch { /* fall through */ }

  _defaultCityId = 1; // Dhaka
  return _defaultCityId;
}

// Zones cache: cityId → zone list (1-hour TTL)
const _zonesByCityCache = new Map<number, { zones: Array<{ zoneId: number; zoneName: string }>; expiry: number }>();
const ZONE_CACHE_TTL = 60 * 60 * 1000;

async function getCachedZones(cityId: number): Promise<Array<{ zoneId: number; zoneName: string }>> {
  const cached = _zonesByCityCache.get(cityId);
  if (cached && Date.now() < cached.expiry) return cached.zones;
  const { zones } = await getPathaoZones(cityId);
  _zonesByCityCache.set(cityId, { zones, expiry: Date.now() + ZONE_CACHE_TTL });
  return zones;
}

/**
 * Resolve zone ID for an order by matching zone names against the delivery address.
 * Falls back to PATHAO_DEFAULT_ZONE_ID env var or the first zone in the city.
 */
async function resolveZoneForAddress(cityId: number, address: string): Promise<number> {
  const envZone = Number(process.env.PATHAO_DEFAULT_ZONE_ID || 0);
  if (envZone) return envZone;

  const zones = await getCachedZones(cityId);
  if (zones.length === 0) return 298;

  const needle = address.toLowerCase();

  // Exact word-boundary match first (e.g. "Dhanmondi" in "Road 6, Dhanmondi, Dhaka")
  for (const z of zones) {
    const zn = z.zoneName.toLowerCase();
    const escaped = zn.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const pattern = new RegExp(String.raw`(?:^|[^a-z])` + escaped + String.raw`(?:[^a-z]|$)`);
    if (pattern.test(needle)) return z.zoneId;
  }

  // Substring fallback
  for (const z of zones) {
    if (needle.includes(z.zoneName.toLowerCase())) return z.zoneId;
  }

  return zones[0].zoneId;
}

// ── Phone format ──────────────────────────────────────────────────────────────

/**
 * Normalize a Bangladesh phone number to local 01XXXXXXXXX format (11 digits).
 * WooCommerce often stores the number with +880 country code prefix.
 */
function formatBDPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return digits.slice(2); // +8801XXXXXXXXX
  if (digits.startsWith('88') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 11 && digits.startsWith('01')) return digits;
  if (digits.length === 10) return '0' + digits;
  return digits.slice(-11); // fallback: take last 11 digits
}

// ── Order creation ─────────────────────────────────────────────────────────────

/**
 * Create a single order in Pathao
 * POST /aladdin/api/v1/orders
 */
export async function createPathaoOrder(order: CommerceOrder, storeId?: number) {
  const cityId = await getDefaultCityId();
  const zoneId = await resolveZoneForAddress(cityId, order.address);

  const body = {
    store_id: storeId ?? Number(process.env.PATHAO_STORE_ID),
    merchant_order_id: String(order.wooId || order.id),
    recipient_name: order.customer,
    recipient_phone: formatBDPhone(order.phone),
    recipient_address: order.address,
    recipient_city: cityId,
    recipient_zone: zoneId,
    delivery_type: Number(process.env.PATHAO_DELIVERY_TYPE || 48),
    item_type: Number(process.env.PATHAO_ITEM_TYPE || 2),
    special_instruction: order.notes || "",
    item_quantity: 1,
    item_weight: Number(process.env.PATHAO_ITEM_WEIGHT || 0.5),
    item_description: Array.isArray(order.items) ? order.items.join(", ") : String(order.items || ""),
    amount_to_collect: Number(order.payable || order.total || 0),
  };

  const missing = Object.entries(body)
    .filter(([, value]) => value === undefined || value === null || value === "" || Number.isNaN(value))
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing Pathao booking fields: ${missing.join(", ")}`);
  }

  const data = await pathaoFetch<PathaoCreateResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    raw: data,
    consignmentId: data.data.consignment_id,
    status: data.data.order_status,
    deliveryFee: data.data.delivery_fee,
  };
}

/**
 * Get status of a single consignment - Short Info
 * GET /aladdin/api/v1/orders/{consignment_id}/info
 */
export async function getPathaoConsignmentInfo(consignmentId: string) {
  const data = await pathaoFetch<{
    message: string;
    type: string;
    code: number;
    data: {
      consignment_id: string;
      merchant_order_id: string;
      order_status: string;
      order_status_slug: string;
      updated_at: string;
      invoice_id: string | null;
    };
  }>(`/orders/${consignmentId}/info`);

  return {
    raw: data,
    consignmentId: data.data.consignment_id,
    merchantOrderId: data.data.merchant_order_id,
    status: data.data.order_status,
    statusSlug: data.data.order_status_slug,
    updatedAt: data.data.updated_at,
    invoiceId: data.data.invoice_id,
  };
}

/**
 * Get cities list
 * GET /aladdin/api/v1/city-list
 */
export async function getPathaoCities() {
  const data = await pathaoFetch<{
    message: string;
    type: string;
    code: number;
    data: {
      data: Array<{
        city_id: number;
        city_name: string;
      }>;
    };
  }>("/city-list");

  return {
    raw: data,
    cities: (data.data.data || []).map((c) => ({
      cityId: c.city_id,
      cityName: c.city_name,
    })),
  };
}

/**
 * Get zones for a city
 * GET /aladdin/api/v1/cities/{city_id}/zone-list
 */
export async function getPathaoZones(cityId: number) {
  const data = await pathaoFetch<{
    message: string;
    type: string;
    code: number;
    data: {
      data: Array<{
        zone_id: number;
        zone_name: string;
      }>;
    };
  }>(`/cities/${cityId}/zone-list`);

  return {
    raw: data,
    zones: (data.data.data || []).map((z) => ({
      zoneId: z.zone_id,
      zoneName: z.zone_name,
    })),
  };
}

/**
 * Get areas for a zone
 * GET /aladdin/api/v1/zones/{zone_id}/area-list
 */
export async function getPathaoAreas(zoneId: number) {
  const data = await pathaoFetch<{
    message: string;
    type: string;
    code: number;
    data: {
      data: Array<{
        area_id: number;
        area_name: string;
        home_delivery_available: boolean;
        pickup_available: boolean;
      }>;
    };
  }>(`/zones/${zoneId}/area-list`);

  return {
    raw: data,
    areas: (data.data.data || []).map((a) => ({
      areaId: a.area_id,
      areaName: a.area_name,
      homeDeliveryAvailable: a.home_delivery_available,
      pickupAvailable: a.pickup_available,
    })),
  };
}

/**
 * Bulk create orders from an array of CommerceOrders
 * POST /aladdin/api/v1/orders/bulk
 * Creates multiple Pathao orders in bulk
 */
export async function bulkCreatePathaoOrders(orders: CommerceOrder[], storeId?: number) {
  // Resolve city once; resolve zone per-order based on address
  const cityId = await getDefaultCityId();

  const payload = {
    orders: await Promise.all(orders.map(async (order) => {
      const zoneId = await resolveZoneForAddress(cityId, order.address);
      return {
        store_id: storeId ?? Number(process.env.PATHAO_STORE_ID),
        merchant_order_id: String(order.wooId || order.id),
        recipient_name: order.customer,
        recipient_phone: formatBDPhone(order.phone),
        recipient_address: order.address,
        recipient_city: cityId,
        recipient_zone: zoneId,
        delivery_type: Number(process.env.PATHAO_DELIVERY_TYPE || 48),
        item_type: Number(process.env.PATHAO_ITEM_TYPE || 2),
        special_instruction: order.notes || "",
        item_quantity: 1,
        item_weight: Number(process.env.PATHAO_ITEM_WEIGHT || 0.5),
        item_description: Array.isArray(order.items) ? order.items.join(", ") : String(order.items || ""),
        amount_to_collect: Number(order.payable || order.total || 0),
      };
    })),
  };

  const data = await pathaoFetch<{
    message: string;
    type: string;
    code: number;
    data: boolean;
  }>("/orders/bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    raw: data,
    accepted: data.code === 202,
    message: data.message,
  };
}

/**
 * Get merchant stores
 * GET /aladdin/api/v1/stores
 */
export async function getPathaoStores() {
  const data = await pathaoFetch<{
    message: string;
    type: string;
    code: number;
    data: {
      data: Array<{
        store_id: number;
        store_name: string;
        store_address: string;
        is_active: number;
        city_id: number;
        zone_id: number;
        hub_id: number;
        is_default_store: boolean;
        is_default_return_store: boolean;
      }>;
      total: number;
      current_page: number;
      per_page: number;
    };
  }>("/stores");

  return {
    raw: data,
    stores: (data.data.data || []).map((s) => ({
      storeId: s.store_id,
      storeName: s.store_name,
      storeAddress: s.store_address,
      isActive: s.is_active === 1,
      cityId: s.city_id,
      zoneId: s.zone_id,
      hubId: s.hub_id,
      isDefaultStore: s.is_default_store,
      isDefaultReturnStore: s.is_default_return_store,
    })),
    total: data.data.total,
    currentPage: data.data.current_page,
  };
}

/**
 * Calculate delivery price
 * POST /aladdin/api/v1/merchant/price-plan
 */
export async function calculatePathaoPrice(params: {
  storeId: number;
  itemType: number;
  deliveryType: number;
  itemWeight: number;
  recipientCity: number;
  recipientZone: number;
}) {
  const data = await pathaoFetch<{
    message: string;
    type: string;
    code: number;
    data: {
      price: number;
      discount: number;
      promo_discount: number;
      plan_id: number;
      cod_enabled: number;
      cod_percentage: number;
      additional_charge: number;
      final_price: number;
    };
  }>("/merchant/price-plan", {
    method: "POST",
    body: JSON.stringify({
      store_id: params.storeId,
      item_type: params.itemType,
      delivery_type: params.deliveryType,
      item_weight: params.itemWeight,
      recipient_city: params.recipientCity,
      recipient_zone: params.recipientZone,
    }),
  });

  return {
    raw: data,
    price: data.data.price,
    discount: data.data.discount,
    promoDiscount: data.data.promo_discount,
    planId: data.data.plan_id,
    codEnabled: data.data.cod_enabled === 1,
    codPercentage: data.data.cod_percentage,
    additionalCharge: data.data.additional_charge,
    finalPrice: data.data.final_price,
  };
}
