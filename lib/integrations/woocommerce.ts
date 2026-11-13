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
  line_items?: Array<{ name: string; quantity?: number; total?: string }>;
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

export type WooOrderLite = Pick<WooOrder, "id" | "status" | "total" | "date_created" | "meta_data">;

/**
 * Fetch every WooCommerce order created in [after, before) with only the fields
 * finance needs. Used to reconstruct history Pathao no longer returns.
 * Dates are YYYY-MM-DD (store local time).
 */
export async function getWooOrdersInRange(after: string, before: string): Promise<WooOrderLite[]> {
  const all: WooOrderLite[] = [];
  for (let page = 1; page <= 50; page++) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
      status: "any",
      after: `${after}T00:00:00`,
      before: `${before}T00:00:00`,
      _fields: "id,status,total,date_created,meta_data",
    });
    const rows = await wooFetch<WooOrderLite[]>(`/orders?${params}`);
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
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
  if (wooStatus === "packed") return "packed";
  if (wooStatus === "dispatched") return "dispatched";
  if (wooStatus === "on-hold") return "hold";
  if (wooStatus === "refunded" || wooStatus === "cancelled" || wooStatus === "failed") return "returned";
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
    // Billing first: checkout fills it and it's what gets edited in wp-admin; shipping is often a stale copy
    address: billing.address_1 || shipping.address_1 || meta.customer_address || "",
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
    city: billing.city || shipping.city || "",
    margin: "Pending",
    notes: order.customer_note || "Synced from WooCommerce.",
    dateCreated: order.date_created || "",
    lineItems: lineItems.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity) || 0,
      total: Number(item.total) || 0,
    })),
  };
}

/** Order count per WooCommerce status slug across the whole store (one request). */
export async function getWooStatusTotals(): Promise<Record<string, number>> {
  const rows = await wooFetch<Array<{ slug: string; total: number }>>("/reports/orders/totals");
  return Object.fromEntries(rows.map((r) => [r.slug, Number(r.total) || 0]));
}

/**
 * Fetch a single page of WooCommerce orders with total count metadata.
 * Used for the paginated Orders view.
 */
export async function getWooOrdersPage(
  page: number,
  perPage: number,
  status?: string,
  search?: string,
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
  if (search) params.set("search", search);

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

/**
 * Fetch every order matching `query` (status may be a comma list). Reads the
 * page count from the first response, then loads the remaining pages in
 * parallel. Throws on failure rather than falling back to mock data, so
 * callers can tell the user.
 */
export async function getAllWooOrders(query: URLSearchParams): Promise<CommerceOrder[]> {
  if (!hasEnv(requiredWooEnv)) throw new Error("WooCommerce credentials are not configured");

  const auth = Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
  ).toString("base64");

  const fetchPage = async (page: number) => {
    const params = new URLSearchParams(query);
    params.set("per_page", "100");
    params.set("page", String(page));
    const response = await fetch(`${getWooBaseURL()}/wp-json/wc/v3/orders?${params}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || `WooCommerce request failed with ${response.status}`);
    return { rows: data as WooOrder[], totalPages: Number(response.headers.get("X-WP-TotalPages") || 1) };
  };

  const first = await fetchPage(1);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => fetchPage(i + 2)),
  );
  return [first, ...rest].flatMap((p) => p.rows).map(normalizeWooOrder);
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
      // Marks this order as genuinely booked by us — the Pathao webhook requires this
      // marker before trusting any consignment ID match, so foreign/unrelated Pathao
      // shipments (e.g. from another store on the same merchant account) can never
      // attach their status to an order we never sent.
      { key: "ptc_booked_by_us",   value: "1" },
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

export type WooLineItem = { product_id: number; name: string; quantity: number; total: number };

/**
 * Line items for the given WooCommerce order ids, fetched 100 at a time.
 * Orders that no longer exist are simply absent from the result.
 */
export async function getWooOrderLineItems(ids: number[]): Promise<Map<number, WooLineItem[]>> {
  const out = new Map<number, WooLineItem[]>();
  const unique = [...new Set(ids.filter(n => Number.isInteger(n) && n > 0))];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const params = new URLSearchParams({
      include: chunk.join(','),
      per_page: '100',
      status: 'any',
      _fields: 'id,line_items',
    });
    const rows = await wooFetch<Array<{ id: number; line_items?: Array<{ product_id: number; name: string; quantity: number; total: string }> }>>(`/orders?${params}`);
    for (const r of rows) {
      out.set(r.id, (r.line_items || []).map(li => ({
        product_id: li.product_id, name: li.name, quantity: Number(li.quantity) || 0, total: Number(li.total) || 0,
      })));
    }
  }
  return out;
}

export type WooStockProduct = {
  id: number;
  name: string;
  sku: string;
  image: string | null;
  price: number;
  /** price before any sale (equals price when nothing is on sale) */
  regularPrice: number;
  stock: number;
  variants: { id: number; size: string; sku: string; stock: number }[];
};

/** Stock on hand for every published product (variable products summed over their variations). */
export async function getWooStockLevels(): Promise<WooStockProduct[]> {
  type P = { id: number; name: string; sku: string; price: string; regular_price: string; type: string; stock_quantity: number | null; variations: number[]; images?: { src: string }[] };
  type V = { id: number; sku: string; regular_price: string; stock_quantity: number | null; attributes: { name: string; option: string }[] };
  const products: P[] = [];
  for (let page = 1; page <= 10; page++) {
    const rows = await wooFetch<P[]>(`/products?per_page=100&page=${page}&status=publish&_fields=id,name,sku,price,regular_price,type,stock_quantity,variations,images`);
    products.push(...rows);
    if (rows.length < 100) break;
  }
  return Promise.all(products.map(async (p) => {
    let variants: WooStockProduct["variants"] = [];
    let regular = Number.parseFloat(p.regular_price) || 0;
    if (p.type === "variable" && p.variations.length) {
      const vs = await wooFetch<V[]>(`/products/${p.id}/variations?per_page=100&_fields=id,sku,regular_price,stock_quantity,attributes`);
      // The parent of a variable product has no regular price of its own
      regular = Math.max(regular, ...vs.map((v) => Number.parseFloat(v.regular_price) || 0));
      variants = vs.map((v) => ({
        id: v.id,
        size: v.attributes.map((a) => a.option).join(" / ") || "—",
        sku: v.sku || "",
        stock: Math.max(0, v.stock_quantity ?? 0),
      }));
    }
    const stock = variants.length ? variants.reduce((s, v) => s + v.stock, 0) : Math.max(0, p.stock_quantity ?? 0);
    const price = Number.parseFloat(p.price) || 0;
    return { id: p.id, name: p.name, sku: p.sku || "", image: p.images?.[0]?.src || null, price, regularPrice: Math.max(regular, price), stock, variants };
  }));
}

/** Set the stock count of a product, or of one of its variations. Returns the saved quantity. */
export async function setWooStock(productId: number, variationId: number | null, quantity: number): Promise<number> {
  const path = variationId ? `/products/${productId}/variations/${variationId}` : `/products/${productId}`;
  const saved = await wooFetch<{ stock_quantity: number | null }>(path, {
    method: "PUT",
    body: JSON.stringify({ manage_stock: true, stock_quantity: quantity }),
  });
  return saved.stock_quantity ?? quantity;
}

/** Units sold per product (and variation) on orders placed since `after` (YYYY-MM-DD), cancelled/refunded excluded. */
export async function getWooUnitsSold(after: string): Promise<{ productId: number; variationId: number; quantity: number; total: number; date: string }[]> {
  type O = { id: number; date_created: string; line_items: { product_id: number; variation_id: number; quantity: number; total: string }[] };
  const out: { productId: number; variationId: number; quantity: number; total: number; date: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const params = new URLSearchParams({
      after: `${after}T00:00:00`, per_page: "100", page: String(page),
      status: "processing,on-hold,completed,packed,dispatched,pending",
      _fields: "id,date_created,line_items",
    });
    const rows = await wooFetch<O[]>(`/orders?${params}`);
    for (const o of rows) {
      for (const li of o.line_items || []) {
        out.push({ productId: li.product_id, variationId: li.variation_id || 0, quantity: Number(li.quantity) || 0, total: Number(li.total) || 0, date: o.date_created.slice(0, 10) });
      }
    }
    if (rows.length < 100) break;
  }
  return out;
}

/** Current stock count of a product or one of its variations, straight from WooCommerce. */
export async function getWooStock(productId: number, variationId: number | null): Promise<number> {
  const path = variationId ? `/products/${productId}/variations/${variationId}` : `/products/${productId}`;
  const row = await wooFetch<{ stock_quantity: number | null }>(`${path}?_fields=stock_quantity`);
  return row.stock_quantity ?? 0;
}

export type WooSyncOrder = {
  id: number;
  number: string;
  status: string;
  total: number;
  dateCreated: string;
  phone: string;
  consignmentId: string;
  pathaoStatus: string;
  bookedByUs: boolean;
};

/** Orders in the given WooCommerce statuses (optionally created after a date), with just what the Pathao sync needs. */
/** Order totals by order id, for the given ids (missing ids are left out). */
export async function getWooOrderTotals(ids: number[]): Promise<Map<number, number>> {
  const totals = new Map<number, number>();
  const unique = [...new Set(ids.filter(n => Number.isInteger(n) && n > 0))];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const rows = await wooFetch<{ id: number; total: string }[]>(
      `/orders?include=${chunk.join(",")}&per_page=100&status=any&_fields=id,total`,
    );
    for (const r of rows) totals.set(r.id, Number(r.total) || 0);
  }
  return totals;
}

export async function getWooOrdersForSync(statuses: string[], after?: string): Promise<WooSyncOrder[]> {
  type Raw = { id: number; number: string; status: string; total: string; date_created: string; billing?: { phone?: string }; meta_data?: { key: string; value: unknown }[] };
  const out: WooSyncOrder[] = [];
  for (let page = 1; page <= 100; page++) {
    const params = new URLSearchParams({
      status: statuses.join(","), per_page: "100", page: String(page), orderby: "id", order: "desc",
      _fields: "id,number,status,total,date_created,billing,meta_data",
    });
    if (after) params.set("after", `${after}T00:00:00`);
    const rows = await wooFetch<Raw[]>(`/orders?${params}`);
    for (const r of rows) {
      const meta = (k: string) => {
        const v = r.meta_data?.find((m) => m.key === k)?.value;
        return typeof v === "string" || typeof v === "number" ? String(v) : "";
      };
      out.push({
        id: r.id, number: String(r.number || r.id), status: r.status, total: Number(r.total) || 0,
        dateCreated: r.date_created, phone: r.billing?.phone || "",
        consignmentId: meta("ptc_consignment_id") || meta("pathao_consignment_id"),
        pathaoStatus: meta("ptc_status") || meta("pathao_status"),
        bookedByUs: meta("ptc_booked_by_us") === "1",
      });
    }
    if (rows.length < 100) break;
  }
  return out;
}

/** Update many orders in one go (WooCommerce batch API, 50 per request). Returns ids that failed. */
export async function batchUpdateWooOrders(updates: { id: number; status?: string; meta_data?: { key: string; value: string }[] }[]): Promise<{ updated: number; failed: { id: number; error: string }[] }> {
  let updated = 0;
  const failed: { id: number; error: string }[] = [];
  for (let i = 0; i < updates.length; i += 50) {
    const chunk = updates.slice(i, i + 50);
    try {
      const res = await wooFetch<{ update?: { id: number; error?: { message?: string } }[] }>("/orders/batch", {
        method: "POST",
        body: JSON.stringify({ update: chunk }),
      });
      for (const r of res.update || []) {
        if (r.error) failed.push({ id: r.id, error: r.error.message || "update failed" });
        else updated++;
      }
    } catch (e) {
      for (const u of chunk) failed.push({ id: u.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { updated, failed };
}

// ─── catalog: store order, prices and stock per size ─────────────────────────

export type CatalogVariant = {
  id: number;
  size: string;
  sku: string;
  regularPrice: string;
  salePrice: string;
  stock: number;
};

export type CatalogProduct = {
  id: number;
  name: string;
  type: string;
  menuOrder: number;
  image: string | null;
  link: string;
  categories: string[];
  /** a sold-out product is hidden from the shop (WooCommerce "hide out of stock" is on) */
  inStock: boolean;
  /** simple products carry their price and stock themselves; variable ones only on their variants */
  regularPrice: string;
  salePrice: string;
  stock: number;
  variants: CatalogVariant[];
};

/** Every published product in the order the shop shows them (menu order, then name), with each size's prices and stock. */
export async function getWooCatalog(): Promise<CatalogProduct[]> {
  type P = {
    id: number; name: string; type: string; menu_order: number; permalink: string; regular_price: string; sale_price: string;
    stock_quantity: number | null; stock_status: string; images?: { src: string }[]; categories?: { name: string }[]; variations: number[];
  };
  type V = { id: number; sku: string; regular_price: string; sale_price: string; stock_quantity: number | null; attributes: { option: string }[] };
  const products: P[] = [];
  for (let page = 1; page <= 10; page++) {
    const rows = await wooFetch<P[]>(`/products?per_page=100&page=${page}&status=publish&_fields=id,name,type,menu_order,permalink,regular_price,sale_price,stock_quantity,stock_status,images,categories,variations`);
    products.push(...rows);
    if (rows.length < 100) break;
  }
  const out = await Promise.all(products.map(async (p): Promise<CatalogProduct> => {
    const vs = p.type === "variable" && p.variations.length
      ? await wooFetch<V[]>(`/products/${p.id}/variations?per_page=100&_fields=id,sku,regular_price,sale_price,stock_quantity,attributes`)
      : [];
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      menuOrder: p.menu_order,
      image: p.images?.[0]?.src || null,
      link: p.permalink,
      categories: (p.categories || []).map((c) => c.name),
      inStock: p.stock_status !== "outofstock",
      regularPrice: p.regular_price || "",
      salePrice: p.sale_price || "",
      stock: p.stock_quantity ?? 0,
      variants: vs.map((v) => ({
        id: v.id,
        size: v.attributes.map((a) => a.option).join(" / ") || "—",
        sku: v.sku || "",
        regularPrice: v.regular_price || "",
        salePrice: v.sale_price || "",
        stock: v.stock_quantity ?? 0,
      })),
    };
  }));
  return out.sort((a, b) => a.menuOrder - b.menuOrder || a.name.localeCompare(b.name));
}

/** Set the menu order (shop position) of many products at once. */
export async function setWooMenuOrder(updates: { id: number; menuOrder: number }[]): Promise<number> {
  let saved = 0;
  for (let i = 0; i < updates.length; i += 100) {
    const res = await wooFetch<{ update?: { id: number; error?: { message: string } }[] }>("/products/batch", {
      method: "POST",
      body: JSON.stringify({ update: updates.slice(i, i + 100).map((u) => ({ id: u.id, menu_order: u.menuOrder })) }),
    });
    const failed = (res.update || []).filter((r) => r.error);
    if (failed.length) throw new Error(`WooCommerce refused ${failed.length} product(s): ${failed[0].error!.message}`);
    saved += (res.update || []).length;
  }
  return saved;
}

export type CatalogChange = { variationId: number | null; regularPrice?: string; salePrice?: string; stock?: number };

/** Live stock of a product, or of each of its variations (by variation id). */
export async function getWooStockById(productId: number): Promise<Map<number | null, number>> {
  const map = new Map<number | null, number>();
  const p = await wooFetch<{ type: string; stock_quantity: number | null }>(`/products/${productId}?_fields=type,stock_quantity`);
  map.set(null, p.stock_quantity ?? 0);
  if (p.type === "variable") {
    const vs = await wooFetch<{ id: number; stock_quantity: number | null }[]>(`/products/${productId}/variations?per_page=100&_fields=id,stock_quantity`);
    for (const v of vs) map.set(v.id, v.stock_quantity ?? 0);
  }
  return map;
}

/** Save price and stock changes for a product (variationId null) and/or its sizes. Only the fields given are touched. */
export async function saveWooCatalogChanges(productId: number, changes: CatalogChange[]): Promise<void> {
  const body = (c: CatalogChange) => ({
    ...(c.regularPrice !== undefined ? { regular_price: c.regularPrice } : {}),
    ...(c.salePrice !== undefined ? { sale_price: c.salePrice } : {}),
    ...(c.stock !== undefined ? { manage_stock: true, stock_quantity: c.stock } : {}),
  });
  const own = changes.find((c) => c.variationId == null);
  if (own) await wooFetch(`/products/${productId}`, { method: "PUT", body: JSON.stringify(body(own)) });
  const sizes = changes.filter((c) => c.variationId != null);
  if (sizes.length) {
    const res = await wooFetch<{ update?: { id: number; error?: { message: string } }[] }>(`/products/${productId}/variations/batch`, {
      method: "POST",
      body: JSON.stringify({ update: sizes.map((c) => ({ id: c.variationId, ...body(c) })) }),
    });
    const failed = (res.update || []).filter((r) => r.error);
    if (failed.length) throw new Error(`WooCommerce refused ${failed.length} size(s): ${failed[0].error!.message}`);
  }
}
