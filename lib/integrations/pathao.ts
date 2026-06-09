import type { CommerceOrder } from "@/lib/types/commerce";
import { hasEnv, requiredPathaoEnv } from "./env";
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function loadArchivedOrders(): PathaoPortalOrder[] {
  const filePath = path.join(process.cwd(), 'lib/data/archived_orders.csv');
  if (!fs.existsSync(filePath)) {
    console.warn('[Pathao] Archived orders CSV file not found at:', filePath);
    return [];
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    if (lines.length <= 1) return [];
    
    const headers = parseCSVLine(lines[0]);
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
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const row = parseCSVLine(line);
      
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

export async function getPathaoPortalOrders(
  fromDate?: string,
  toDate?: string,
): Promise<PathaoPortalOrder[]> {
  const isDefaultQuery = !fromDate && !toDate;

  // When called with no date filter, use in-memory cache to avoid hammering the API
  if (isDefaultQuery) {
    if (_allOrdersCache && Date.now() < _allOrdersCacheExpiry) {
      return _allOrdersCache;
    }
    // Apply lookback from Jan 1, 2025 so we retrieve all historical orders
    fromDate = '2025-01-01';
  }

  // Load archived historical orders from CSV (July 2024 to Feb 2026)
  const archivedOrders = loadArchivedOrders();

  // Filter archived orders based on range
  const filteredArchived = archivedOrders.filter(o => {
    const d = o.order_created_at.slice(0, 10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });

  // Decide if we need to fetch live orders from Pathao API
  // CSV covers up to '2026-02-28'. If the query range extends after that, fetch live data.
  const queryEnd = toDate || new Date().toISOString().slice(0, 10);
  const needsLiveFetch = queryEnd > '2026-02-28';

  const liveOrders: PathaoPortalOrder[] = [];

  if (needsLiveFetch) {
    // Fetch live starting from '2026-03-01' or fromDate (whichever is later)
    const liveFromDate = (!fromDate || fromDate < '2026-03-01') ? '2026-03-01' : fromDate;
    
    try {
      const token = await getMerchantPortalToken();
      let page = 1;
      const perPage = 100;
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (true) {
        const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
        params.set("from_date", liveFromDate);
        if (toDate) params.set("to_date", toDate);

        const res = await fetch(
          `https://merchant.pathao.com/api/v1/orders/all?${params}`,
          {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
          }
        );

        if (res.status === 429) {
          if (retryCount >= MAX_RETRIES) {
            console.warn(`[Pathao] Rate limit exceeded after ${MAX_RETRIES} retries. Returning partial live orders.`);
            break;
          }
          retryCount++;
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        
        retryCount = 0;

        const json = await res.json() as {
          code: number;
          data: { data: PathaoPortalOrder[]; total: number; last_page: number; current_page: number };
        };

        const rows = json.data?.data ?? [];
        liveOrders.push(...rows);
        if (page >= (json.data?.last_page ?? 1) || rows.length === 0) break;
        page++;
        
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (apiError) {
      console.error('[Pathao] Failed to fetch live orders from API:', apiError);
    }
  }

  // Combine and deduplicate
  const combinedMap = new Map<string, PathaoPortalOrder>();
  for (const o of filteredArchived) {
    if (o.order_consignment_id) {
      combinedMap.set(o.order_consignment_id, o);
    }
  }
  for (const o of liveOrders) {
    if (o.order_consignment_id) {
      combinedMap.set(o.order_consignment_id, o);
    }
  }

  const allCombined = Array.from(combinedMap.values());

  // Cache all-time results
  if (isDefaultQuery) {
    _allOrdersCache = allCombined;
    _allOrdersCacheExpiry = Date.now() + ALL_ORDERS_CACHE_TTL;
  }

  return allCombined;
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
export async function createPathaoOrder(order: CommerceOrder) {
  const cityId = await getDefaultCityId();
  const zoneId = await resolveZoneForAddress(cityId, order.address);

  const body = {
    store_id: Number(process.env.PATHAO_STORE_ID),
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
export async function bulkCreatePathaoOrders(orders: CommerceOrder[]) {
  // Resolve city once; resolve zone per-order based on address
  const cityId = await getDefaultCityId();

  const payload = {
    orders: await Promise.all(orders.map(async (order) => {
      const zoneId = await resolveZoneForAddress(cityId, order.address);
      return {
        store_id: Number(process.env.PATHAO_STORE_ID),
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
