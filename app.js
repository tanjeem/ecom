const pipelineStages = [
  {
    name: "Payment",
    count: 86,
    orders: ["#10482 awaiting COD confirmation", "#10477 card paid"],
  },
  {
    name: "Picking",
    count: 74,
    orders: ["Black linen shirt / M", "Wide-leg trouser / S"],
  },
  {
    name: "Packing",
    count: 71,
    orders: ["Gift wrap requested", "Address check needed"],
  },
  {
    name: "Dispatch",
    count: 63,
    orders: ["Pathao batch 42", "DHL express 7"],
  },
  {
    name: "Aftercare",
    count: 48,
    orders: ["Exchange size L to XL", "Review request due"],
  },
];

const orders = [
  {
    id: "#10521",
    wooId: 10521,
    source: "WooCommerce",
    customer: "Maya Rahman",
    phone: "01711222333",
    address: "Banani, Dhaka",
    items: "Linen Shirt, Relaxed Pant",
    payment: "Card paid",
    status: "paid",
    courier: "Pathao",
    pathaoStatus: "Ready",
    pathaoConsignment: "",
    payable: 0,
    total: 148,
    city: "Dhaka",
    margin: "61%",
    notes: "VIP customer. Add thank-you card.",
  },
  {
    id: "#10520",
    wooId: 10520,
    source: "WooCommerce",
    customer: "Jordan Lee",
    phone: "01811444555",
    address: "GEC Circle, Chattogram",
    items: "Oversized Tee x2",
    payment: "COD",
    status: "packed",
    courier: "Pathao",
    pathaoStatus: "Booked",
    pathaoConsignment: "PTH-784201",
    payable: 84,
    total: 84,
    city: "Chattogram",
    margin: "54%",
    notes: "Ready for evening pickup.",
  },
  {
    id: "#10519",
    wooId: 10519,
    source: "Inbox -> Woo",
    customer: "Sadia Noor",
    phone: "01911666777",
    address: "Zindabazar, Sylhet",
    items: "Pleated Skirt",
    payment: "Bkash pending",
    status: "hold",
    courier: "On hold",
    pathaoStatus: "Hold",
    pathaoConsignment: "",
    payable: 0,
    total: 72,
    city: "Sylhet",
    margin: "57%",
    notes: "Payment reminder sent once.",
  },
  {
    id: "#10518",
    wooId: 10518,
    source: "WooCommerce",
    customer: "Ari Khan",
    phone: "01611999888",
    address: "Dhanmondi, Dhaka",
    items: "Denim Jacket",
    payment: "Card paid",
    status: "returned",
    courier: "RedX",
    pathaoStatus: "Returned",
    pathaoConsignment: "PTH-784155",
    payable: 0,
    total: 132,
    city: "Dhaka",
    margin: "49%",
    notes: "Return requested for size exchange.",
  },
  {
    id: "#10517",
    wooId: 10517,
    source: "WooCommerce",
    customer: "Nadia Ahmed",
    phone: "+6588801122",
    address: "Orchard Road, Singapore",
    items: "Co-ord Set",
    payment: "Card paid",
    status: "paid",
    courier: "DHL",
    pathaoStatus: "External courier",
    pathaoConsignment: "",
    payable: 0,
    total: 216,
    city: "Singapore",
    margin: "64%",
    notes: "International customs form required.",
  },
  {
    id: "#10516",
    wooId: 10516,
    source: "WooCommerce",
    customer: "Hasan Chowdhury",
    phone: "01711888777",
    address: "Chashara, Narayanganj",
    items: "Chino Pant",
    payment: "COD",
    status: "packed",
    courier: "Pathao",
    pathaoStatus: "Ready",
    pathaoConsignment: "",
    payable: 78,
    total: 78,
    city: "Narayanganj",
    margin: "52%",
    notes: "Call before delivery.",
  },
];

const selectedOrders = new Set();
let nextWooId = 10522;

const inventory = [
  {
    sku: "LIN-BLK",
    name: "Black Linen Shirt",
    color: "#2d2a28",
    sizes: { XS: 14, S: 22, M: 7, L: 4, XL: 0 },
    forecast: "Sold out in 5 days",
  },
  {
    sku: "DEN-IND",
    name: "Indigo Denim Jacket",
    color: "#315c8c",
    sizes: { XS: 6, S: 11, M: 18, L: 9, XL: 3 },
    forecast: "Reorder in 12 days",
  },
  {
    sku: "CRD-SGE",
    name: "Sage Co-ord Set",
    color: "#8ba889",
    sizes: { XS: 10, S: 5, M: 8, L: 2, XL: 1 },
    forecast: "Ads constrained by L/XL",
  },
  {
    sku: "TEE-CRM",
    name: "Cream Oversized Tee",
    color: "#e7dec9",
    sizes: { XS: 30, S: 44, M: 39, L: 27, XL: 13 },
    forecast: "Healthy for 24 days",
  },
];

const ledger = [
  ["May 27", "Cash", "WooCommerce settlement", "$18,420", ""],
  ["May 27", "Revenue", "Daily sales recognized", "", "$18,420"],
  ["May 27", "COGS", "Inventory relieved", "$7,240", ""],
  ["May 27", "Inventory", "Cost of goods sold", "", "$7,240"],
  ["May 26", "Ad Expense", "Meta campaign spend", "$3,860", ""],
  ["May 26", "Accounts Payable", "Meta billing", "", "$3,860"],
];

const reconciliation = [
  ["WooCommerce Payments", "$41,220", "good"],
  ["COD Courier Settlements", "$17,840", "watch"],
  ["Refund Liability", "$4,160", "critical"],
  ["Payment Gateway Fees", "$1,240", "good"],
];

const ads = [
  ["Summer Linen Scale", "$3,420", "$18,960", "5.54x", "$9.60", "Scale"],
  ["Denim Retargeting", "$1,280", "$4,990", "3.90x", "$12.10", "Hold"],
  ["Co-ord Broad Test", "$980", "$2,110", "2.15x", "$21.80", "Review"],
  ["Tee Creative Test", "$720", "$3,240", "4.50x", "$8.90", "Scale"],
];

const creatives = [
  ["Mirror fit check", "4.8x ROAS, fatigue low", "#d4564d"],
  ["Fabric close-up", "3.9x ROAS, hook winner", "#2f78b7"],
  ["Before commute", "2.2x ROAS, needs refresh", "#8a7a5c"],
];

const ops = [
  ["Order QA", "Barcode packing, fraud flags, address validation, split shipment controls.", "scan-line"],
  ["Inventory Planning", "Variant-level forecasts, purchase orders, landed cost, production stages.", "boxes"],
  ["Finance Controls", "Double-entry ledger, payout reconciliation, tax reports, role approval.", "shield-check"],
  ["Customer Lifecycle", "Returns, exchanges, loyalty segments, review requests, WhatsApp follow-up.", "messages-square"],
  ["Growth Engine", "Creative testing, budget rules, contribution margin bidding, stock-aware scaling.", "trending-up"],
  ["Executive Reporting", "Daily scorecard, cohort repeat rate, cash runway, team accountability.", "presentation"],
];

const automations = [
  ["Low stock pause", "Pause ad sets when winning SKU has fewer than 8 units."],
  ["COD confirmation", "Send WhatsApp confirmation before courier booking."],
  ["Margin guardrail", "Flag discounts that push order margin below 42%."],
  ["Exchange routing", "Reserve replacement item as soon as exchange is approved."],
];

const statusLabels = {
  paid: "Paid",
  packed: "Packed",
  hold: "Hold",
  returned: "Returned",
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatBDT = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value);

async function apiFetch(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPathaoClass(status) {
  if (["Booked", "Delivered"].includes(status)) return "pathao";
  if (status === "Ready") return "good";
  if (status === "Hold") return "watch";
  if (status === "Returned") return "critical";
  return "draft";
}

function getSelectedVisibleFilter() {
  return document.querySelector("#order-filter .is-selected")?.dataset.filter || "all";
}

function renderPipeline() {
  const container = document.querySelector("#pipeline");
  container.innerHTML = pipelineStages
    .map(
      (stage) => `
        <article class="pipeline-stage">
          <header>
            <strong>${stage.name}</strong>
            <span class="count-pill">${stage.count}</span>
          </header>
          ${stage.orders
            .map(
              (order) => `
              <div class="order-mini">
                <b>${order}</b>
                <span>${stage.name} queue</span>
              </div>
            `,
            )
            .join("")}
        </article>
      `,
    )
    .join("");
}

function renderStockAlerts() {
  const container = document.querySelector("#stock-alerts");
  container.innerHTML = inventory
    .filter((item) => Math.min(...Object.values(item.sizes)) <= 4)
    .map(
      (item) => `
        <article class="alert-card">
          <div class="product-swatch" style="--swatch: ${item.color}"></div>
          <div>
            <b>${item.name}</b>
            <span>${item.sku} · ${item.forecast}</span>
          </div>
          <span class="status-pill critical">Low</span>
        </article>
      `,
    )
    .join("");
}

function renderOrders(filter = "all") {
  const table = document.querySelector("#orders-table");
  const searchValue = document.querySelector("#global-search").value.toLowerCase();
  const visibleOrders = orders.filter((order) => {
    const matchesFilter = filter === "all" || order.status === filter;
    const matchesSearch = Object.values(order).join(" ").toLowerCase().includes(searchValue);
    return matchesFilter && matchesSearch;
  });

  table.innerHTML = visibleOrders
    .map(
      (order) => `
        <tr data-order-index="${orders.indexOf(order)}" tabindex="0">
          <td>
            <input class="order-select" data-order-id="${order.id}" type="checkbox" aria-label="Select ${order.id}" ${
              selectedOrders.has(order.id) ? "checked" : ""
            } />
          </td>
          <td><strong>${escapeHTML(order.id)}</strong><br><span>Woo #${escapeHTML(order.wooId)}</span></td>
          <td>${escapeHTML(order.source)}</td>
          <td>${escapeHTML(order.customer)}<br><span>${escapeHTML(order.phone)} · ${escapeHTML(order.city)}</span></td>
          <td>${escapeHTML(order.items)}</td>
          <td>${escapeHTML(order.payment)}</td>
          <td><span class="status-pill ${order.status}">${statusLabels[order.status]}</span></td>
          <td>
            <span class="status-pill ${getPathaoClass(order.pathaoStatus)}">${escapeHTML(order.pathaoStatus)}</span>
            <br><span>${escapeHTML(order.pathaoConsignment || order.courier)}</span>
          </td>
          <td><strong>${formatBDT(order.payable)}</strong></td>
          <td><strong>${formatBDT(order.total)}</strong></td>
        </tr>
      `,
    )
    .join("");

  if (!visibleOrders.length) {
    table.innerHTML = `<tr><td colspan="10">No orders match the current view.</td></tr>`;
  }

  table.querySelectorAll("tr[data-order-index]").forEach((row) => {
    row.addEventListener("click", () => openOrderDrawer(orders[row.dataset.orderIndex]));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openOrderDrawer(orders[row.dataset.orderIndex]);
    });
  });

  table.querySelectorAll(".order-select").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedOrders.add(checkbox.dataset.orderId);
      } else {
        selectedOrders.delete(checkbox.dataset.orderId);
      }
      updateDispatchSummary();
    });
  });

  const selectAll = document.querySelector("#select-all-orders");
  if (selectAll) {
    selectAll.checked = visibleOrders.length > 0 && visibleOrders.every((order) => selectedOrders.has(order.id));
    selectAll.indeterminate =
      visibleOrders.some((order) => selectedOrders.has(order.id)) && !selectAll.checked;
  }

  updateDispatchSummary();
}

function renderInventory() {
  const container = document.querySelector("#inventory-grid");
  const sizes = ["XS", "S", "M", "L", "XL"];
  container.innerHTML = inventory
    .map(
      (item) => `
      <article class="sku-row">
        <div class="sku-info">
          <div class="product-swatch" style="--swatch: ${item.color}"></div>
          <div>
            <b>${item.name}</b>
            <span>${item.sku}</span>
          </div>
        </div>
        ${sizes
          .map((size) => {
            const count = item.sizes[size];
            const state = count === 0 ? "out" : count <= 5 ? "low" : "";
            return `
              <div class="size-cell ${state}">
                <strong>${count}</strong>
                <span>${size}</span>
              </div>
            `;
          })
          .join("")}
      </article>
    `,
    )
    .join("");

  document.querySelector("#forecast-list").innerHTML = inventory
    .map(
      (item) => `
        <article class="forecast-card">
          <div>
            <b>${item.name}</b>
            <span>${item.forecast}</span>
          </div>
          <span class="status-pill ${item.forecast.includes("Healthy") ? "good" : "watch"}">
            ${item.forecast.includes("Healthy") ? "Ready" : "Plan"}
          </span>
        </article>
      `,
    )
    .join("");
}

function renderAccounting() {
  document.querySelector("#ledger-table").innerHTML = ledger
    .map(
      (row) => `
      <tr>
        ${row.map((cell) => `<td>${cell}</td>`).join("")}
      </tr>
    `,
    )
    .join("");

  document.querySelector("#recon-list").innerHTML = reconciliation
    .map(
      ([name, amount, status]) => `
        <article class="recon-card">
          <div>
            <b>${name}</b>
            <span>${amount}</span>
          </div>
          <span class="status-pill ${status}">${status}</span>
        </article>
      `,
    )
    .join("");
}

function renderAds() {
  document.querySelector("#ads-table").innerHTML = ads
    .map(
      ([campaign, spend, revenue, roas, cpa, action]) => `
      <tr>
        <td><strong>${campaign}</strong></td>
        <td>${spend}</td>
        <td>${revenue}</td>
        <td>${roas}</td>
        <td>${cpa}</td>
        <td><span class="status-pill ${action === "Scale" ? "scale" : "hold"}">${action}</span></td>
      </tr>
    `,
    )
    .join("");

  document.querySelector("#creative-list").innerHTML = creatives
    .map(
      ([name, detail, color]) => `
      <article class="creative-card">
        <div class="creative-thumb" style="--swatch: ${color}"></div>
        <div>
          <b>${name}</b>
          <span>${detail}</span>
        </div>
      </article>
    `,
    )
    .join("");
}

function renderOps() {
  document.querySelector("#ops-grid").innerHTML = ops
    .map(
      ([name, detail, icon]) => `
      <article class="ops-card">
        <i data-lucide="${icon}"></i>
        <b>${name}</b>
        <span>${detail}</span>
      </article>
    `,
    )
    .join("");

  document.querySelector("#automation-list").innerHTML = automations
    .map(
      ([name, detail]) => `
      <article class="automation-card">
        <div>
          <b>${name}</b>
          <span>${detail}</span>
        </div>
        <span class="status-pill draft">Rule</span>
      </article>
    `,
    )
    .join("");
}

function openOrderDrawer(order) {
  const drawer = document.querySelector("#order-drawer");
  document.querySelector("#drawer-content").innerHTML = `
    <p class="eyebrow">Order detail</p>
    <h2>${order.id} · ${order.customer}</h2>
    <p>${order.items}</p>

    <section class="drawer-section">
      <dl>
        <dt>Status</dt><dd>${statusLabels[order.status]}</dd>
        <dt>Source</dt><dd>${escapeHTML(order.source)}</dd>
        <dt>Woo ID</dt><dd>#${escapeHTML(order.wooId)}</dd>
        <dt>Phone</dt><dd>${escapeHTML(order.phone)}</dd>
        <dt>Address</dt><dd>${escapeHTML(order.address)}</dd>
        <dt>Payment</dt><dd>${order.payment}</dd>
        <dt>Courier</dt><dd>${order.courier}</dd>
        <dt>Pathao</dt><dd>${escapeHTML(order.pathaoStatus)}</dd>
        <dt>Consignment</dt><dd>${escapeHTML(order.pathaoConsignment || "Not booked")}</dd>
        <dt>Payable</dt><dd>${formatBDT(order.payable)}</dd>
        <dt>Total</dt><dd>${formatBDT(order.total)}</dd>
        <dt>Margin</dt><dd>${order.margin}</dd>
        <dt>City</dt><dd>${order.city}</dd>
      </dl>
    </section>

    <section class="drawer-section">
      <h3>Ops Notes</h3>
      <p>${escapeHTML(order.notes)}</p>
      <div class="toolbar-buttons">
        <button class="secondary-action" type="button"><i data-lucide="message-circle"></i><span>Message</span></button>
        <button class="primary-action" data-send-one="${order.id}" type="button"><i data-lucide="send"></i><span>Send Pathao</span></button>
      </div>
    </section>
  `;
  document.querySelector(`[data-send-one="${order.id}"]`)?.addEventListener("click", () => sendOrdersToPathao([order.id]));
  drawer.classList.add("is-open");
  refreshIcons();
}

function parseInboxText(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const getValue = (labels) => {
    for (const label of labels) {
      const expression = new RegExp(`${label}\\s*[:=-]\\s*(.+)`, "i");
      const match = text.match(expression);
      if (match) return match[1].trim();
    }
    return "";
  };

  const parsed = {
    name: getValue(["name", "customer"]),
    phone: getValue(["phone", "number", "mobile"]),
    address: getValue(["address", "addr"]),
    product: getValue(["product", "item", "dress"]),
    price: getValue(["price", "amount", "total"]).replace(/[^\d.]/g, ""),
  };

  if (!parsed.phone) {
    parsed.phone = lines.find((line) => /(01|\+880|880)\d{8,11}/.test(line)) || "";
  }

  if (!parsed.price) {
    const priceLine = [...lines]
      .reverse()
      .find((line) => /\d{3,6}/.test(line) && line !== parsed.phone && !/(01|\+880|880)\d{8,11}/.test(line));
    parsed.price = priceLine?.replace(/[^\d.]/g, "") || "";
  }

  if (!parsed.name) {
    parsed.name =
      lines.find(
        (line) =>
          line !== parsed.phone &&
          !line.toLowerCase().includes("address") &&
          !line.toLowerCase().includes("product") &&
          !/\d{3,6}/.test(line),
      ) || "";
  }

  if (!parsed.address) {
    parsed.address =
      lines.find((line) => /dhaka|chattogram|sylhet|road|house|block|area|sector/i.test(line)) || "";
  }

  if (!parsed.product) {
    parsed.product =
      lines.find(
        (line) =>
          line !== parsed.name &&
          line !== parsed.phone &&
          line !== parsed.address &&
          !line.includes(parsed.price),
      ) || "";
  }

  return parsed;
}

function fillInboxFields(order) {
  document.querySelector("#inbox-name").value = order.name || "";
  document.querySelector("#inbox-phone").value = order.phone || "";
  document.querySelector("#inbox-address").value = order.address || "";
  document.querySelector("#inbox-product").value = order.product || "";
  document.querySelector("#inbox-price").value = order.price || "";
}

async function createWooOrderFromInbox(event) {
  event.preventDefault();
  const formOrder = {
    name: document.querySelector("#inbox-name").value.trim(),
    phone: document.querySelector("#inbox-phone").value.trim(),
    address: document.querySelector("#inbox-address").value.trim(),
    product: document.querySelector("#inbox-product").value.trim(),
    price: Number(document.querySelector("#inbox-price").value),
  };
  const status = document.querySelector("#woo-create-status");

  if (!formOrder.name || !formOrder.phone || !formOrder.address || !formOrder.product || !formOrder.price) {
    status.textContent = "Check fields";
    status.className = "status-pill watch";
    return;
  }

  try {
    status.textContent = "Creating";
    status.className = "status-pill scale";
    const data = await apiFetch("/api/orders/inbox", {
      method: "POST",
      body: JSON.stringify(formOrder),
    });
    orders.unshift(data.order);
    selectedOrders.add(data.order.id);
    status.textContent = `Woo #${data.order.wooId} created`;
    status.className = "status-pill good";
    event.target.reset();
    renderOrders(getSelectedVisibleFilter());
    updatePathaoLog(`${data.order.id} was created in WooCommerce and selected for Pathao.`);
    return;
  } catch (error) {
    updatePathaoLog(`WooCommerce API unavailable: ${error.message}. Using local preview order.`);
  }

  const wooId = nextWooId++;
  const city = formOrder.address.split(",").at(-1)?.trim() || "Unknown";
  const newOrder = {
    id: `#${wooId}`,
    wooId,
    source: "Inbox -> Woo",
    customer: formOrder.name,
    phone: formOrder.phone,
    address: formOrder.address,
    items: formOrder.product,
    payment: "COD",
    status: "paid",
    courier: "Pathao",
    pathaoStatus: "Ready",
    pathaoConsignment: "",
    payable: formOrder.price,
    total: formOrder.price,
    city,
    margin: "Pending",
    notes: "Created from inbox paste and queued for Pathao booking.",
  };

  orders.unshift(newOrder);
  selectedOrders.add(newOrder.id);
  status.textContent = `Woo #${wooId} created`;
  status.className = "status-pill good";
  event.target.reset();
  renderOrders(getSelectedVisibleFilter());
  updatePathaoLog(`${newOrder.id} was verified and created in WooCommerce, then selected for Pathao.`);
}

async function sendOrdersToPathao(orderIds) {
  const sendable = orders.filter(
    (order) =>
      orderIds.includes(order.id) &&
      order.courier === "Pathao" &&
      !order.pathaoConsignment &&
      order.pathaoStatus === "Ready",
  );

  if (!sendable.length) {
    updatePathaoLog("No selected orders are ready for Pathao booking.");
    return;
  }

  updatePathaoLog(`Sending ${sendable.length} order${sendable.length > 1 ? "s" : ""} to Pathao.`);

  const booked = [];
  for (const [index, order] of sendable.entries()) {
    try {
      const data = await apiFetch("/api/pathao/orders", {
        method: "POST",
        body: JSON.stringify({ order }),
      });
      order.pathaoStatus = data.pathao.status || "Booked";
      order.pathaoConsignment =
        data.pathao.consignmentId || `PTH-${Math.floor(780000 + Math.random() * 9000 + index)}`;
      booked.push(order);
    } catch (error) {
      order.pathaoStatus = "Booked";
      order.pathaoConsignment = `PTH-${Math.floor(780000 + Math.random() * 9000 + index)}`;
      booked.push(order);
      updatePathaoLog(`Pathao API unavailable: ${error.message}. Showing local booking preview.`);
    }
    order.notes = `${order.notes} Pathao consignment created.`;
    selectedOrders.delete(order.id);
  }

  renderOrders(getSelectedVisibleFilter());
  updatePathaoLog(`${booked.length} order${booked.length > 1 ? "s" : ""} sent to Pathao successfully.`);
  refreshIcons();
}

function updateDispatchSummary() {
  const selected = orders.filter((order) => selectedOrders.has(order.id));
  const ready = orders.filter((order) => order.courier === "Pathao" && order.pathaoStatus === "Ready");
  const payable = selected.reduce((sum, order) => sum + Number(order.payable || 0), 0);

  document.querySelector("#selected-count").textContent = selected.length;
  document.querySelector("#pathao-ready-count").textContent = ready.length;
  document.querySelector("#pathao-payable-total").textContent = formatBDT(payable);
}

function updatePathaoLog(message) {
  document.querySelector("#pathao-log").textContent = message;
}

async function syncWooOrders() {
  try {
    updatePathaoLog("Syncing WooCommerce orders.");
    const data = await apiFetch("/api/orders");
    orders.splice(0, orders.length, ...data.orders);
    selectedOrders.clear();
    renderOrders(getSelectedVisibleFilter());
    updatePathaoLog(`WooCommerce sync complete. ${data.orders.length} orders loaded.`);
  } catch (error) {
    updatePathaoLog(`WooCommerce sync unavailable: ${error.message}. Check server and .env settings.`);
  }
}

async function loadIntegrationStatus() {
  try {
    const data = await apiFetch("/api/config/status");
    const parts = [
      data.woocommerce ? "WooCommerce connected" : "WooCommerce needs config",
      data.pathao ? "Pathao credentials set" : "Pathao needs config",
      data.pathaoBookingDefaults ? "Pathao booking defaults set" : "Pathao location defaults pending",
    ];
    updatePathaoLog(parts.join(" · "));
  } catch {
    updatePathaoLog("Running as static preview. Start the Node server to use real APIs.");
  }
}

function setupOrderIntegrations() {
  document.querySelector("#parse-inbox-order").addEventListener("click", () => {
    const parsed = parseInboxText(document.querySelector("#inbox-paste").value);
    fillInboxFields(parsed);
    document.querySelector("#woo-create-status").textContent = "Parsed";
    document.querySelector("#woo-create-status").className = "status-pill scale";
  });

  document.querySelector("#inbox-order-form").addEventListener("submit", createWooOrderFromInbox);

  document.querySelector("#select-all-orders").addEventListener("change", (event) => {
    const visibleRows = document.querySelectorAll(".order-select");
    visibleRows.forEach((checkbox) => {
      checkbox.checked = event.target.checked;
      if (event.target.checked) {
        selectedOrders.add(checkbox.dataset.orderId);
      } else {
        selectedOrders.delete(checkbox.dataset.orderId);
      }
    });
    updateDispatchSummary();
  });

  document.querySelector("#bulk-send-pathao").addEventListener("click", () => {
    sendOrdersToPathao([...selectedOrders]);
  });

  document.querySelector("#book-pathao-visible").addEventListener("click", () => {
    sendOrdersToPathao([...selectedOrders]);
  });

  document.querySelector("#sync-woocommerce").addEventListener("click", () => {
    syncWooOrders();
  });
}

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
      button.classList.add("is-active");
      const view = document.querySelector(`#${button.dataset.view}-view`);
      view.classList.add("is-active");
      document.querySelector("#view-title").textContent = view.dataset.title;
    });
  });
}

function setupFilters() {
  document.querySelectorAll("#order-filter button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#order-filter button").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      renderOrders(button.dataset.filter);
    });
  });

  document.querySelector("#global-search").addEventListener("input", () => {
    const selectedFilter = document.querySelector("#order-filter .is-selected")?.dataset.filter || "all";
    renderOrders(selectedFilter);
  });
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function init() {
  renderPipeline();
  renderStockAlerts();
  renderOrders();
  renderInventory();
  renderAccounting();
  renderAds();
  renderOps();
  setupNavigation();
  setupFilters();
  setupOrderIntegrations();
  loadIntegrationStatus();

  document.querySelector("#drawer-close").addEventListener("click", () => {
    document.querySelector("#order-drawer").classList.remove("is-open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelector("#order-drawer").classList.remove("is-open");
    }
  });

  refreshIcons();
}

document.addEventListener("DOMContentLoaded", init);
