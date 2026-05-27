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

function normalizeStatus(status: string): OrderStatus {
  if (["processing", "completed"].includes(status)) return "paid";
  if (status === "on-hold") return "hold";
  if (status === "refunded") return "returned";
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
    status: normalizeStatus(order.status),
    courier: "Pathao",
    pathaoStatus: meta.ptc_status || meta.pathao_status || "Not Booked",
    pathaoConsignment: meta.ptc_consignment_id || meta.pathao_consignment_id || "",
    payable: Number(meta.pathao_payable || order.total || 0),
    total: Number(order.total || 0),
    city: shipping.city || billing.city || "",
    margin: "Pending",
    notes: order.customer_note || "Synced from WooCommerce.",
    dateCreated: order.date_created || "",
  };
}

export async function getWooOrders(searchParams: URLSearchParams) {
  // Return mock data if WooCommerce is not configured
  if (!hasEnv(requiredWooEnv)) {
    return getMockOrders();
  }

  try {
    const status = searchParams.get("status");
    const after = searchParams.get("after");
    const before = searchParams.get("before");

    // Paginate through all results (WooCommerce max per_page is 100)
    const allOrders: WooOrder[] = [];
    let page = 1;
    while (true) {
      const query = new URLSearchParams({
        per_page: "100",
        page: String(page),
        orderby: "date",
        order: "desc",
      });
      if (status) query.set("status", status);
      if (after) query.set("after", after);
      if (before) query.set("before", before);

      const batch = await wooFetch<WooOrder[]>(`/orders?${query.toString()}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      allOrders.push(...batch);
      if (batch.length < 100) break; // last page
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
  const name = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const address = String(payload.address || "").trim();
  const product = String(payload.product || "").trim();
  const price = Number(payload.price || 0);

  if (!name || !phone || !address || !product || !price) {
    throw new Error("Name, phone, address, product, and price are required");
  }

  const { firstName, lastName } = splitName(name);
  const city = String(payload.city || address.split(",").at(-1) || "").trim();
  const lineItems = payload.productId
    ? [
        {
          product_id: Number(payload.productId),
          variation_id: payload.variationId ? Number(payload.variationId) : undefined,
          quantity: Number(payload.quantity || 1),
        },
      ]
    : undefined;

  const created = await wooFetch<WooOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      payment_method: "cod",
      payment_method_title: "Cash on delivery",
      set_paid: false,
      status: "processing",
      billing: {
        first_name: firstName,
        last_name: lastName,
        phone,
        address_1: address,
        city,
        country: "BD",
      },
      shipping: {
        first_name: firstName,
        last_name: lastName,
        address_1: address,
        city,
        country: "BD",
      },
      line_items: lineItems,
      fee_lines: lineItems
        ? undefined
        : [
            {
              name: product,
              total: String(price),
            },
          ],
      meta_data: [
        { key: "_threadops_source", value: "Inbox -> Woo" },
        { key: "customer_phone", value: phone },
        { key: "customer_address", value: address },
        { key: "product_text", value: product },
        { key: "pathao_status", value: "Ready" },
        { key: "pathao_payable", value: String(price) },
      ],
    }),
  });

  return normalizeWooOrder(created);
}
