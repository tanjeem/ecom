import type { CommerceOrder } from "@/lib/types/commerce";
import { hasEnv, requiredPathaoEnv } from "./env";

type PathaoTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  message?: string;
};

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

async function getPathaoToken() {
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
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await response.json()) as PathaoTokenResponse;

  if (!response.ok) {
    throw new Error(data.message || `Pathao token request failed with ${response.status}`);
  }

  const token = data.access_token;
  if (!token) throw new Error("Pathao token response did not include an access token");
  return token;
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

/**
 * Create a single order in Pathao
 * POST /aladdin/api/v1/orders
 */
export async function createPathaoOrder(order: CommerceOrder) {
  const body = {
    store_id: Number(process.env.PATHAO_STORE_ID),
    merchant_order_id: String(order.wooId || order.id),
    recipient_name: order.customer,
    recipient_phone: order.phone,
    recipient_address: order.address,
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
  const payload = {
    orders: orders.map((order) => ({
      store_id: Number(process.env.PATHAO_STORE_ID),
      merchant_order_id: String(order.wooId || order.id),
      recipient_name: order.customer,
      recipient_phone: order.phone,
      recipient_address: order.address,
      delivery_type: Number(process.env.PATHAO_DELIVERY_TYPE || 48),
      item_type: Number(process.env.PATHAO_ITEM_TYPE || 2),
      special_instruction: order.notes || "",
      item_quantity: 1,
      item_weight: Number(process.env.PATHAO_ITEM_WEIGHT || 0.5),
      item_description: Array.isArray(order.items) ? order.items.join(", ") : String(order.items || ""),
      amount_to_collect: Number(order.payable || order.total || 0),
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
