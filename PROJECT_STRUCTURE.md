# ThreadOps Commerce OS - Project Structure

**Project Type:** Next.js + TypeScript  
**Package Manager:** npm  
**Node Version:** Latest LTS recommended  
**Created:** May 2026

## 📋 Quick Overview

ThreadOps Commerce OS is an integrated operations dashboard for scaling ecommerce brands. It unifies order management, inventory, accounting, and marketing operations across WooCommerce, Pathao delivery, and Meta Ads.

### Core Features
- Executive dashboard with KPIs (sales, margin, cash position)
- WooCommerce order synchronization and management
- Inbox order entry and parsing
- Pathao courier integration for dispatch
- Inventory management with demand forecasting
- Accounting with general ledger and reconciliation
- Meta Ads campaign tracking and scaling
- Scale operations planning and automations

---

## 📁 Directory Structure

```
ecom/
├── app/                          # Next.js App Router
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout wrapper
│   ├── page.tsx                 # Home page component
│   └── api/                     # Server API routes
│       ├── config/
│       │   └── status/
│       │       └── route.ts     # Config status check
│       ├── orders/
│       │   ├── route.ts         # GET/POST orders from WooCommerce
│       │   └── inbox/
│       │       └── route.ts     # Create orders from inbox
│       └── pathao/
│           └── orders/
│               ├── route.ts     # Bulk Pathao order creation
│               └── [consignmentId]/
│                   └── route.ts # Pathao consignment status
│
├── components/                  # React components (future)
│   └── [Empty - for component organization]
│
├── lib/                         # Shared utilities and types
│   ├── types/
│   │   └── commerce.ts          # TypeScript interfaces
│   │       ├── OrderStatus
│   │       ├── CommerceOrder
│   │       ├── InboxOrderInput
│   │       ├── InventoryItem
│   │       └── ConfigStatus
│   │
│   ├── integrations/            # External service integrations
│   │   ├── env.ts               # Environment validation utilities
│   │   ├── woocommerce.ts       # WooCommerce API client
│   │   │   ├── getWooOrders()
│   │   │   ├── createWooOrder()
│   │   │   └── wooFetch()
│   │   └── pathao.ts            # Pathao delivery API client
│   │       ├── getPathaoToken()
│   │       ├── createPathaoOrder()
│   │       ├── getPathaoStatus()
│   │       └── pathaoFetch()
│   │
│   └── data/
│       └── mock.ts              # Mock data for frontend
│
├── public/                      # Static assets
│   └── [images, icons, etc]
│
├── Root Files
│   ├── index.html               # Legacy static HTML (reference)
│   ├── app.js                   # Legacy static JS (reference)
│   ├── styles.css               # Legacy static CSS (reference)
│   ├── server.js                # Express server for static HTML
│   │
│   ├── package.json             # Dependencies & scripts
│   ├── tsconfig.json            # TypeScript configuration
│   ├── next.config.mjs          # Next.js configuration
│   │
│   ├── .env.example             # Environment template
│   ├── .env.local               # Environment secrets (gitignored)
│   ├── .gitignore               # Git ignore rules
│   └── README.md                # Project README
```

---

## 🔧 Core Concepts & Files

### 1. **Types** (`lib/types/commerce.ts`)
Defines all TypeScript interfaces used across the application.

```typescript
OrderStatus = "paid" | "packed" | "hold" | "returned"

CommerceOrder {
  id, wooId, source, customer, phone, address, items,
  payment, status, courier, pathaoStatus, pathaoConsignment,
  payable, total, city, margin, notes
}

InboxOrderInput {
  name, phone, address, product, price, productId, variationId, quantity, city
}

InventoryItem {
  sku, name, color, sizes (XS-XL stock levels), forecast
}

ConfigStatus {
  woocommerce, pathao, pathaoBookingDefaults
}
```

### 2. **WooCommerce Integration** (`lib/integrations/woocommerce.ts`)
Handles all WooCommerce REST API operations.

**Key Functions:**
- `getWooOrders(params)` - Fetch orders from WooCommerce with filtering
- `createWooOrder(input)` - Create new order from inbox entry
- `wooFetch(endpoint, options)` - Base HTTP client with Basic Auth
- `formatOrderFromWoo(wooOrder)` - Transform WooCommerce format to CommerceOrder

**Environment Variables Required:**
- `WOOCOMMERCE_URL` - Base URL (e.g., https://store.com)
- `WOOCOMMERCE_CONSUMER_KEY` - API key
- `WOOCOMMERCE_CONSUMER_SECRET` - API secret

### 3. **Pathao Integration** (`lib/integrations/pathao.ts`)
Handles Pathao delivery service API.

**Key Functions:**
- `getPathaoToken()` - OAuth token retrieval (cached per request)
- `createPathaoOrder(order)` - Create shipping order on Pathao
- `getPathaoStatus(consignmentId)` - Check delivery status
- `pathaoFetch(endpoint, options)` - Bearer token authenticated fetch

**Environment Variables Required:**
- `PATHAO_BASE_URL` - API base (https://api-hermes.pathao.com)
- `PATHAO_CLIENT_ID` - OAuth client ID
- `PATHAO_CLIENT_SECRET` - OAuth client secret
- `PATHAO_USERNAME` - Account username (optional)
- `PATHAO_PASSWORD` - Account password (optional)
- `PATHAO_STORE_ID` - Store ID in Pathao
- `PATHAO_SENDER_NAME` - Default sender name
- `PATHAO_SENDER_PHONE` - Default sender phone
- `PATHAO_CITY_ID` - Default city
- `PATHAO_ZONE_ID` - Default zone
- `PATHAO_AREA_ID` - Default area

### 4. **Environment Validation** (`lib/integrations/env.ts`)
Validates required environment variables at runtime.

**Exported:**
- `requiredWooEnv` - Array of required WooCommerce vars
- `requiredPathaoEnv` - Array of required Pathao vars
- `hasEnv(envArray)` - Boolean check for all required vars

### 5. **API Routes** (`app/api/`)

#### `GET /api/orders`
Syncs WooCommerce orders to frontend.
- Query params: status, limit, page (WooCommerce filter params)
- Returns: `{ orders: CommerceOrder[] }`

#### `POST /api/orders/inbox`
Creates WooCommerce order from inbox form entry.
- Body: `InboxOrderInput`
- Returns: `{ order: CommerceOrder }`

#### `GET /api/pathao/orders`
Fetches Pathao order statuses.
- Returns: `{ orders: PathaoOrderStatus[] }`

#### `POST /api/pathao/orders`
Bulk create Pathao orders.
- Body: `{ orderIds: string[] }`
- Returns: `{ consignments: PathaoConsignment[] }`

#### `GET /api/pathao/orders/[consignmentId]`
Get specific Pathao consignment status.
- Returns: `{ status, delivery_fee, updated_at }`

#### `GET /api/config/status`
Check service connectivity.
- Returns: `{ woocommerce: boolean, pathao: boolean, pathaoBookingDefaults: boolean }`

---

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Environment Setup
```bash
cp .env.example .env.local
# Edit .env.local with actual WooCommerce and Pathao credentials
```

### Development
```bash
npm run dev
# Runs on http://localhost:3000
```

### Production Build
```bash
npm run build
npm start
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

---

## 📊 Data Flow

### Order Creation Flow (Inbox → WooCommerce)
1. User pastes order details in inbox form
2. Frontend sends POST `/api/orders/inbox` with `InboxOrderInput`
3. Backend calls `wooFetch()` to create order in WooCommerce
4. Returns `CommerceOrder` to frontend
5. Frontend refreshes orders table

### Dispatch Flow (Orders → Pathao)
1. User selects orders in table with checkboxes
2. Clicks "Send Selected to Pathao" button
3. Frontend sends POST `/api/pathao/orders` with order IDs
4. Backend calls `createPathaoOrder()` for each order
5. Returns consignment IDs and tracking
6. Frontend displays in Pathao dispatch log

### Order Sync Flow (WooCommerce → Dashboard)
1. User clicks "Sync Woo Orders" or page loads
2. Frontend sends GET `/api/orders` with filters
3. Backend calls `getWooOrders()` to fetch from WooCommerce
4. Returns array of `CommerceOrder` objects
5. Frontend renders orders table

---

## 🔐 Security Considerations

- **Credentials**: All API keys stored in `.env.local` (server-side only)
- **Environment Vars**: Validated at integration layer before use
- **API Routes**: Server-side rendering prevents credential exposure
- **Auth Methods**: 
  - WooCommerce: Basic Auth (key:secret in header)
  - Pathao: Bearer token (OAuth 2.0)
- **No Client-Side Secrets**: Frontend never receives credentials

---

## 📦 Dependencies

### Production
- `next` - React framework
- `react` - UI library
- `react-dom` - React DOM utilities
- `lucide-react` - Icon library

### Development
- `typescript` - Type checking
- `@types/node` - Node.js types
- `@types/react` - React types
- `@types/react-dom` - React DOM types
- `eslint` - Linting
- `eslint-config-next` - Next.js linting rules

---

## 🎯 Frontend Structure (HTML/CSS)

The main UI is in `index.html` with CSS in `styles.css`. Navigation sections:

1. **Dashboard** - KPI metrics and operational summaries
2. **Orders** - Order queue, inbox tool, Pathao dispatch
3. **Inventory** - SKU matrix, demand forecast
4. **Accounting** - P&L, ledger, reconciliation
5. **Meta Ads** - Campaign performance, creative library
6. **Scale Ops** - Operating processes, automations

Each section has a corresponding `.view` div in HTML with ID `{section}-view`.

---

## 🔄 Next Steps for Development

1. **Implement Components**: Convert HTML into React components in `components/`
2. **Complete API Routes**: Implement remaining endpoints with error handling
3. **Add Frontend State**: Use React hooks or state management for data
4. **Add Error Boundaries**: Handle API failures gracefully
5. **Add Logging**: Implement request/response logging for debugging
6. **Add Tests**: Write unit tests for integrations and API routes
7. **Add Caching**: Implement Redis or in-memory caching for order status
8. **Add Webhooks**: Listen for WooCommerce order events instead of polling

---

## 📞 Support Resources

- **WooCommerce API**: https://woocommerce.com/documentation/plugins/woocommerce/woocommerce-rest-api/
- **Pathao API**: https://pathao.com/api-documentation
- **Next.js Docs**: https://nextjs.org/docs
- **TypeScript**: https://www.typescriptlang.org/docs

---

## 👤 Onboarding Checklist for Sonnet (or New Developers)

- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Review this PROJECT_STRUCTURE.md
- [ ] Copy `.env.example` to `.env.local` and fill with test credentials
- [ ] Run `npm run dev` and test the dashboard
- [ ] Review `lib/types/commerce.ts` to understand data models
- [ ] Review `lib/integrations/woocommerce.ts` to understand WooCommerce flow
- [ ] Review `lib/integrations/pathao.ts` to understand delivery flow
- [ ] Test API routes with curl or Postman
- [ ] Identify first feature to work on

---

**Last Updated:** May 27, 2026
**Maintained By:** Development Team
