# ThreadOps Commerce OS

A Next.js operations app for a scaling ecommerce clothing brand. It includes a React dashboard, server-side API routes, WooCommerce order sync, inbox order creation, and Pathao dispatch scaffolding.

## What This MVP Covers

- Executive dashboard with sales, orders, margin, cash, stock, and Meta ROAS.
- WooCommerce order management with payment state, courier state, customer notes, and order detail drawer.
- Inbox order entry that parses pasted customer details, verifies the order, and creates a WooCommerce order.
- Pathao dispatch workflow with selectable rows, single booking, bulk booking, status, consignment, and payable amount.
- Inventory management with SKU, color, size matrix, stock alerts, and demand forecast.
- Accounting with revenue, COGS, operating expense, profit, ledger, and reconciliation surfaces.
- Meta ads management with campaign economics, creative tracking, and stock-aware scale actions.
- Scale operations covering QA, production planning, returns, finance controls, growth, reporting, and automations.

## Open The App

For the connected app, run the built-in Node server:

```bash
node server.js
```

Then visit `http://localhost:5173`.

Install dependencies first:

```bash
npm install
```

Then run:

```bash
npm run dev
```

Visit `http://localhost:3000`.

The old static files are still present as legacy reference, but the active application is the Next.js app under `app/`, `lib/`, and `components/`.

## Environment

Secrets must stay server-side. Use `.env.example` as the template for `.env.local`.

Required WooCommerce values:

- `WOOCOMMERCE_URL`
- `WOOCOMMERCE_CONSUMER_KEY`
- `WOOCOMMERCE_CONSUMER_SECRET`

Required Pathao values:

- `PATHAO_BASE_URL`
- `PATHAO_CLIENT_ID`
- `PATHAO_CLIENT_SECRET`

Pathao booking also needs the merchant sender/store and location defaults:

- `PATHAO_STORE_ID`
- `PATHAO_SENDER_NAME`
- `PATHAO_SENDER_PHONE`
- `PATHAO_CITY_ID`
- `PATHAO_ZONE_ID`
- `PATHAO_AREA_ID`

## Production Architecture Direction

Recommended production stack:

- Frontend: Next.js or React with a design system and role-based routes.
- Backend: Node/NestJS, Laravel, or Django with a modular service layer.
- Database: PostgreSQL for transactional data, Redis for queues/cache.
- Jobs: background workers for courier bookings, Meta sync, bank reconciliation, and notifications.
- Files: S3-compatible storage for invoices, creative assets, shipment labels, and purchase orders.
- Analytics: warehouse or Postgres read models for cohort, margin, ad, and inventory reporting.

Core modules:

- Identity and roles: owner, finance, operations, warehouse, marketer, customer support.
- Orders: sales channels, payment status, packing, shipping, returns, exchanges, fraud checks.
- Inventory: products, variants, lots, warehouses, stock movements, purchase orders, landed costs.
- Accounting: chart of accounts, journal entries, invoices, COGS, taxes, payouts, reconciliation.
- Meta ads: campaign sync, spend, ROAS, CPA, creative fatigue, audience performance, budget rules.
- CRM: segments, support notes, WhatsApp/SMS/email templates, loyalty and repeat purchase flows.
- Reporting: daily scorecard, P&L, contribution margin, cash flow, stock coverage, channel mix.

Important integrations:

- Storefront: WordPress WooCommerce for orders, customers, products, and payment status.
- Payments: Stripe, local payment gateways, mobile wallet, COD settlement files.
- Shipping: courier APIs for label booking, tracking, delivery exceptions, and returns.
- Ads: Meta Marketing API for campaigns, ad sets, ads, insights, creatives, and spend.
- Messaging: WhatsApp Business API, SMS, email provider.
- Accounting export: QuickBooks/Xero export or local tax reports if needed.

## Data Model Starter

Primary entities:

- `customers`
- `orders`
- `order_items`
- `payments`
- `shipments`
- `returns`
- `products`
- `variants`
- `inventory_movements`
- `purchase_orders`
- `suppliers`
- `accounts`
- `journal_entries`
- `journal_lines`
- `ad_accounts`
- `campaigns`
- `ad_sets`
- `ads`
- `creative_assets`
- `daily_metrics`
- `automation_rules`

## WooCommerce And Pathao Flow

Order sync:

- Pull new WooCommerce orders on a schedule and through webhooks.
- Keep WooCommerce as the source of truth for customer, product, price, payment, and order status.
- Store local operational fields for packing, courier booking, Pathao status, payable amount, and internal notes.

Inbox order:

- Staff pastes customer name, phone number, delivery address, product name, variation, and price.
- The app parses the text into editable fields.
- After verification, the backend creates a WooCommerce order through the WooCommerce REST API.
- The new WooCommerce order appears in the queue and can be sent to Pathao.

Pathao dispatch:

- Single order booking sends one WooCommerce order to Pathao.
- Bulk booking sends all checked ready orders to Pathao.
- Pathao response should save consignment ID, delivery status, payable amount, delivery fee, and tracking data.
- A scheduled status sync should refresh Pathao order status and COD payable amounts.

Implemented Next API endpoints:

- `GET /api/config/status`
- `GET /api/orders`
- `POST /api/orders/inbox`
- `POST /api/pathao/orders`
- `GET /api/pathao/orders/:consignmentId`

## Next Build Slice

The next practical step is filling `.env.local` with the store URL, WooCommerce keys, and Pathao store/location defaults, then testing a real WooCommerce sync and a Pathao sandbox booking.
