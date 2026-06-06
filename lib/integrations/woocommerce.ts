import type { CommerceOrder, InboxOrderInput, OrderStatus } from "@/lib/types/commerce";
import { hasEnv, requiredWooEnv } from "./env";

type WooMeta = {
  key: string;
  value: string;
};

type WooOrder = {
  id: number;
  number?: string;
  status: string;
  total?: string;
  date_created?: string;
  payment_method?: string;
  payment_method_title?: string;
  customer_note?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address_1?: string;
    city?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    city?: string;
  };
  line_items?: Array<{ name: string }>;
  fee_lines?: Array<{ name: string }>;
  meta_data?: WooMeta[];
};

function getWooBaseURL() {
  const url = process.env.WOOCOMMERCE_URL;
  if (!url) throw new Error("WOOCOMMERCE_URL is not configured");
  return url.replace(/\/$/, "");
}

async function wooFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!hasEnv(requiredWooEnv)) {
    throw new Error("WooCommerce credentials are not configured");
  }

  const auth = Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
  ).toString("base64");

  const response = await fetch(`${getWooBaseURL()}/wp-json/wc/v3${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || `WooCommerce request failed with ${response.status}`);
  }

  return data as T;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts.shift() || "Customer",
    lastName: parts.join(" "),
  };
}

function normalizeStatus(wooStatus: string, threadopsStatus?: string): OrderStatus {
  // _threadops_status meta takes priority (used for "packed" which has no WooCommerce equivalent)
  if (threadopsStatus === "packed") return "packed";
  if (threadopsStatus === "hold") return "hold";
  if (threadopsStatus === "returned") return "returned";
  if (wooStatus === "on-hold") return "hold";
  if (wooStatus === "refunded" || wooStatus === "cancelled") return "returned";
  if (wooStatus === "completed") return "completed";
  if (wooStatus === "processing" || wooStatus === "pending") return "paid";
  return "paid";
}

export function normalizeWooOrder(order: WooOrder): CommerceOrder {
  const shipping = order.shipping || {};
  const billing = order.billing || {};
  const lineItems = order.line_items || [];
  const feeLines = order.fee_lines || [];
  const meta = Object.fromEntries((order.meta_data || []).map((item) => [item.key, item.value]));

  return {
    id: `#${order.number || order.id}`,
    wooId: order.id,
    source: meta._threadops_source || "WooCommerce",
    customer:
      `${billing.first_name || shipping.first_name || ""} ${billing.last_name || shipping.last_name || ""}`.trim() ||
      "Customer",
    phone: billing.phone || meta.customer_phone || "",
    address: shipping.address_1 || billing.address_1 || meta.customer_address || "",
    items:
      lineItems.map((item) => item.name).join(", ") ||
      feeLines.map((item) => item.name).join(", ") ||
      meta.product_text ||
      "Order item",
    payment: order.payment_method_title || order.payment_method || "Unknown",
    status: normalizeStatus(order.status, meta._threadops_status),
    courier: "Pathao",
    pathaoStatus: meta.ptc_status || meta.pathao_status || "Not Booked",
    pathaoConsignment: meta.ptc_consignment_id || meta.pathao_consignment_id || "",
    payable: Number(meta.pathao_payable || order.total || 0),
    total: Number(order.total || 0),
    deliveryFee: Number(meta.pathao_delivery_fee || 0) || undefined,
    city: shipping.city || billing.city || "",
    margin: "Pending",
    notes: order.customer_note || "Synced from WooCommerce.",
    dateCreated: order.date_created || "",
  };
}

/**
 * Fetch a single page of WooCommerce orders with total count metadata.
 * Used for the paginated Orders view.
 */
export async function getWooOrdersPage(
  page: number,
  perPage: number,
  status?: string,
): Promise<{ orders: CommerceOrder[]; total: number; totalPages: number }> {
  if (!hasEnv(requiredWooEnv)) {
    return { orders: getMockOrders(), total: 3, totalPages: 1 };
  }

  const auth = Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
  ).toString("base64");

  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
    orderby: "date",
    order: "desc",
  });
  if (status) params.set("status", status);

  const response = await fetch(`${getWooBaseURL()}/wp-json/wc/v3/orders?${params}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const total = Number(response.headers.get("X-WP-Total") || 0);
  const totalPages = Number(response.headers.get("X-WP-TotalPages") || 1);
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(data?.message || `WooCommerce request failed with ${response.status}`);
  }

  const orders = Array.isArray(data) ? data.map(normalizeWooOrder) : getMockOrders();
  return { orders, total, totalPages };
}

/**
 * Fetch WooCommerce orders.
 * By default returns only the first page (100 newest) for fast UI rendering.
 * Pass paginate:true only when you need the full dataset (e.g. reporting/metrics).
 */
export async function getWooOrders(
  searchParams: URLSearchParams,
  opts: { paginate?: boolean; perPage?: number } = {},
) {
  if (!hasEnv(requiredWooEnv)) return getMockOrders();

  const perPage = opts.perPage ?? 100;

  try {
    const status = searchParams.get("status");
    const after  = searchParams.get("after");
    const before = searchParams.get("before");

    const baseQuery = new URLSearchParams({
      per_page: String(perPage),
      orderby: "date",
      order: "desc",
    });
    if (status) baseQuery.set("status", status);
    if (after)  baseQuery.set("after",  after);
    if (before) baseQuery.set("before", before);

    if (!opts.paginate) {
      // Fast path: single request, newest orders only
      baseQuery.set("page", "1");
      const orders = await wooFetch<WooOrder[]>(`/orders?${baseQuery}`);
      return Array.isArray(orders) ? orders.map(normalizeWooOrder) : getMockOrders();
    }

    // Full pagination (used by metrics/reporting)
    const allOrders: WooOrder[] = [];
    let page = 1;
    while (true) {
      baseQuery.set("page", String(page));
      const batch = await wooFetch<WooOrder[]>(`/orders?${baseQuery}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      allOrders.push(...batch);
      if (batch.length < perPage) break;
      page++;
    }
    return allOrders.map(normalizeWooOrder);
  } catch (error) {
    console.warn("Failed to fetch from WooCommerce, returning mock data:", error);
    return getMockOrders();
  }
}

function getMockOrders(): CommerceOrder[] {
  return [
    {
      id: "#1001",
      wooId: 1001,
      source: "WooCommerce",
      customer: "Ayesha Khan",
      phone: "01700000001",
      address: "Gulshan, Dhaka",
      items: "Black Linen Shirt",
      payment: "Cash on Delivery",
      status: "paid",
      courier: "Pathao",
      pathaoStatus: "Delivered",
      pathaoConsignment: "PC-001",
      payable: 2450,
      total: 2450,
      city: "Dhaka",
      margin: "Pending",
      notes: "Mock order for testing",
    },
    {
      id: "#1002",
      wooId: 1002,
      source: "WooCommerce",
      customer: "Farah Ahmed",
      phone: "01700000002",
      address: "Banani, Dhaka",
      items: "White Cotton Robe",
      payment: "Cash on Delivery",
      status: "packed",
      courier: "Pathao",
      pathaoStatus: "Ready",
      pathaoConsignment: "",
      payable: 3200,
      total: 3200,
      city: "Dhaka",
      margin: "Pending",
      notes: "Mock order for testing",
    },
    {
      id: "#1003",
      wooId: 1003,
      source: "WooCommerce",
      customer: "Noor Hassan",
      phone: "01700000003",
      address: "Dhanmondi, Dhaka",
      items: "Navy Chambray Shirt",
      payment: "Cash on Delivery",
      status: "hold",
      courier: "Pathao",
      pathaoStatus: "Ready",
      pathaoConsignment: "",
      payable: 2800,
      total: 2800,
      city: "Dhaka",
      margin: "Pending",
      notes: "Mock order for testing",
    },
  ];
}

export async function createInboxWooOrder(payload: InboxOrderInput) {
  const name    = String(payload.name    || "").trim();
  const phone   = String(payload.phone   || "").trim();
  const address = String(payload.address || "").trim();
  const price   = Number(payload.price   || 0);

  // Support multi-item orders passed as `items` array; fall back to legacy single-product fields
  const lines: Array<{ product: string; productId?: number; variationId?: number; qty: number; price: number }> =
    payload.items?.length
      ? payload.items.map((i) => ({ product: i.product, productId: i.productId, variationId: i.variationId, qty: i.qty, price: i.price }))
      : [{ product: String(payload.product || "").trim(), productId: payload.productId, variationId: payload.variationId, qty: Number(payload.quantity || 1), price }];

  const totalPrice     = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const productText    = lines.map((l) => l.product).join(", ");
  const deliveryCharge = Number(payload.deliveryCharge || 0);
  const codPayable     = totalPrice + deliveryCharge;

  if (!name || !phone || !address || !productText || !totalPrice) {
    throw new Error("Name, phone, address, product, and price are required");
  }

  const { firstName, lastName } = splitName(name);
  const city = String(payload.city || address.split(",").at(-1) || "").trim();

  // Use line_items for products with WooCommerce IDs; fall back to fee_lines for free-text items
  const hasWooIds = lines.every((l) => l.productId);
  const lineItems = hasWooIds
    ? lines.map((l) => ({
        product_id: Number(l.productId),
        variation_id: l.variationId ? Number(l.variationId) : undefined,
        quantity: l.qty,
      }))
    : undefined;

  const feeLines = hasWooIds
    ? undefined
    : lines.map((l) => ({ name: l.product, total: String(l.price * l.qty) }));

  const created = await wooFetch<WooOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      payment_method: "cod",
      payment_method_title: "Cash on delivery",
      set_paid: false,
      status: "processing",
      billing:  { first_name: firstName, last_name: lastName, phone, address_1: address, city, country: "BD" },
      shipping: { first_name: firstName, last_name: lastName, address_1: address, city, country: "BD" },
      line_items: lineItems,
      fee_lines:  feeLines,
      meta_data: [
        { key: "_threadops_source", value: "Inbox -> Woo" },
        { key: "customer_phone",   value: phone },
        { key: "customer_address", value: address },
        { key: "product_text",     value: productText },
        { key: "pathao_status",    value: "Ready" },
        { key: "pathao_payable",   value: String(codPayable) },
        ...(deliveryCharge > 0 ? [{ key: "pathao_delivery_fee", value: String(deliveryCharge) }] : []),
      ],
    }),
  });

  return normalizeWooOrder(created);
}

/**
 * Write Pathao consignment ID and status back to a WooCommerce order's meta.
 * Called immediately after a successful Pathao booking so the order shows
 * the live consignment ID on next load without waiting for a webhook.
 */
export async function updateWooOrderPathaoMeta(
  wooId: number,
  consignmentId: string,
  pathaoStatus: string,
  deliveryFee?: number,
): Promise<void> {
  if (!hasEnv(requiredWooEnv)) return;
  try {
    const auth = Buffer.from(
      `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
    ).toString("base64");
    const meta: Array<{ key: string; value: string }> = [
      { key: "ptc_consignment_id", value: consignmentId },
      { key: "ptc_status",         value: pathaoStatus  },
    ];
    if (deliveryFee != null) meta.push({ key: "pathao_delivery_fee", value: String(deliveryFee) });
    await fetch(`${getWooBaseURL()}/wp-json/wc/v3/orders/${wooId}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ meta_data: meta }),
      cache: "no-store",
    });
  } catch (e) {
    console.warn(`updateWooOrderPathaoMeta(${wooId}):`, e);
  }
}

export async function updateWooOrderStatus(wooId: number, status: string): Promise<void> {
  if (!hasEnv(requiredWooEnv)) return;
  try {
    const auth = Buffer.from(
      `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
    ).toString("base64");
    await fetch(`${getWooBaseURL()}/wp-json/wc/v3/orders/${wooId}`, {
      method: "PUT",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ status }),
      cache: "no-store",
    });
  } catch (e) {
    console.warn(`updateWooOrderStatus(${wooId}, ${status}):`, e);
  }
}
