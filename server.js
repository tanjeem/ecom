const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

loadEnv();
const PORT = Number(process.env.PORT || 5173);

const requiredWooEnv = ["WOOCOMMERCE_URL", "WOOCOMMERCE_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_SECRET"];
const requiredPathaoEnv = ["PATHAO_BASE_URL", "PATHAO_CLIENT_ID", "PATHAO_CLIENT_SECRET"];

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function hasEnv(keys) {
  return keys.every((key) => Boolean(process.env[key]));
}

function sendJSON(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getWooBaseURL() {
  return process.env.WOOCOMMERCE_URL.replace(/\/$/, "");
}

async function wooFetch(endpoint, options = {}) {
  if (!hasEnv(requiredWooEnv)) {
    throw new Error("WooCommerce credentials are not configured");
  }

  const url = new URL(`${getWooBaseURL()}/wp-json/wc/v3${endpoint}`);
  const auth = Buffer.from(
    `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`,
  ).toString("base64");

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || `WooCommerce request failed with ${response.status}`);
  }

  return data;
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return {
    firstName: parts.shift() || "Customer",
    lastName: parts.join(" "),
  };
}

function normalizeWooOrder(order) {
  const shipping = order.shipping || {};
  const billing = order.billing || {};
  const lineItems = order.line_items || [];
  const feeLines = order.fee_lines || [];
  const pathaoMeta = Object.fromEntries(
    (order.meta_data || []).map((item) => [item.key, item.value]),
  );

  return {
    id: `#${order.number || order.id}`,
    wooId: order.id,
    source: pathaoMeta._threadops_source || "WooCommerce",
    customer:
      `${billing.first_name || shipping.first_name || ""} ${billing.last_name || shipping.last_name || ""}`.trim() ||
      "Customer",
    phone: billing.phone || pathaoMeta.customer_phone || "",
    address:
      shipping.address_1 ||
      billing.address_1 ||
      pathaoMeta.customer_address ||
      "",
    items:
      lineItems.map((item) => item.name).join(", ") ||
      feeLines.map((item) => item.name).join(", ") ||
      pathaoMeta.product_text ||
      "Order item",
    payment: order.payment_method_title || order.payment_method || "Unknown",
    status: ["processing", "completed"].includes(order.status)
      ? "paid"
      : order.status === "on-hold"
        ? "hold"
        : order.status === "refunded"
          ? "returned"
          : "paid",
    courier: pathaoMeta.pathao_consignment_id ? "Pathao" : "Pathao",
    pathaoStatus: pathaoMeta.pathao_status || "Ready",
    pathaoConsignment: pathaoMeta.pathao_consignment_id || "",
    payable: Number(pathaoMeta.pathao_payable || order.total || 0),
    total: Number(order.total || 0),
    city: shipping.city || billing.city || "",
    margin: "Pending",
    notes: order.customer_note || "Synced from WooCommerce.",
  };
}

async function getWooOrders(url) {
  const params = new URLSearchParams(url.search);
  const page = params.get("page") || "1";
  const status = params.get("status");
  const query = new URLSearchParams({
    per_page: "50",
    page,
    orderby: "date",
    order: "desc",
  });
  if (status) query.set("status", status);
  const orders = await wooFetch(`/orders?${query.toString()}`);
  return orders.map(normalizeWooOrder);
}

async function createInboxWooOrder(payload) {
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

  const created = await wooFetch("/orders", {
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

async function getPathaoToken() {
  if (!hasEnv(requiredPathaoEnv)) {
    throw new Error("Pathao credentials are not configured");
  }

  const baseURL = process.env.PATHAO_BASE_URL.replace(/\/$/, "");
  const body = {
    client_id: process.env.PATHAO_CLIENT_ID,
    client_secret: process.env.PATHAO_CLIENT_SECRET,
    grant_type: process.env.PATHAO_USERNAME && process.env.PATHAO_PASSWORD ? "password" : "client_credentials",
  };

  if (process.env.PATHAO_USERNAME && process.env.PATHAO_PASSWORD) {
    body.username = process.env.PATHAO_USERNAME;
    body.password = process.env.PATHAO_PASSWORD;
  }

  const response = await fetch(`${baseURL}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || `Pathao token request failed with ${response.status}`);
  }

  return data.access_token || data.token || data.data?.access_token;
}

async function pathaoFetch(endpoint, options = {}) {
  const token = await getPathaoToken();
  const baseURL = process.env.PATHAO_BASE_URL.replace(/\/$/, "");
  const response = await fetch(`${baseURL}/aladdin/api/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || `Pathao request failed with ${response.status}`);
  }

  return data;
}

async function createPathaoOrder(payload) {
  const order = payload.order || payload;
  const body = {
    store_id: Number(payload.storeId || process.env.PATHAO_STORE_ID),
    merchant_order_id: String(order.wooId || order.id || ""),
    sender_name: payload.senderName || process.env.PATHAO_SENDER_NAME || "Store",
    sender_phone: payload.senderPhone || process.env.PATHAO_SENDER_PHONE || "",
    recipient_name: order.customer,
    recipient_phone: order.phone,
    recipient_address: order.address,
    city_id: Number(payload.cityId || process.env.PATHAO_CITY_ID),
    zone_id: Number(payload.zoneId || process.env.PATHAO_ZONE_ID),
    area_id: Number(payload.areaId || process.env.PATHAO_AREA_ID),
    special_instruction: order.notes || "",
    item_quantity: Number(payload.quantity || 1),
    item_weight: Number(process.env.PATHAO_ITEM_WEIGHT || 1),
    amount_to_collect: Number(order.payable || order.total || 0),
    item_description: order.items,
    delivery_type: Number(process.env.PATHAO_DELIVERY_TYPE || 48),
    item_type: Number(process.env.PATHAO_ITEM_TYPE || 2),
  };

  const missing = Object.entries(body)
    .filter(([, value]) => value === undefined || value === null || value === "" || Number.isNaN(value))
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing Pathao booking fields: ${missing.join(", ")}`);
  }

  const data = await pathaoFetch("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    raw: data,
    consignmentId: data.consignment_id || data.data?.consignment_id,
    status: data.order_status || data.data?.order_status || "Booked",
    deliveryFee: data.delivery_fee || data.data?.delivery_fee || 0,
  };
}

async function handleAPI(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/config/status") {
      sendJSON(res, 200, {
        woocommerce: hasEnv(requiredWooEnv),
        pathao: hasEnv(requiredPathaoEnv),
        pathaoBookingDefaults: hasEnv(["PATHAO_STORE_ID", "PATHAO_CITY_ID", "PATHAO_ZONE_ID", "PATHAO_AREA_ID"]),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/orders") {
      sendJSON(res, 200, { orders: await getWooOrders(url) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/orders/inbox") {
      const payload = await readBody(req);
      sendJSON(res, 201, { order: await createInboxWooOrder(payload) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/pathao/orders") {
      const payload = await readBody(req);
      sendJSON(res, 201, { pathao: await createPathaoOrder(payload) });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/pathao/orders/")) {
      const consignmentId = decodeURIComponent(url.pathname.split("/").at(-1));
      sendJSON(res, 200, { pathao: await pathaoFetch(`/orders/${consignmentId}`) });
      return;
    }

    sendJSON(res, 404, { error: "API route not found" });
  } catch (error) {
    sendJSON(res, 400, { error: error.message });
  }
}

function serveStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": STATIC_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    handleAPI(req, res, url);
    return;
  }

  serveStatic(req, res, url);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`ThreadOps running at http://localhost:${PORT}`);
});
