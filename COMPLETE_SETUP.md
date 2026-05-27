# ThreadOps Commerce OS - Complete Setup Guide

## 📋 Project Overview

ThreadOps Commerce OS is a modern Next.js + React + TypeScript dashboard for e-commerce operations management. It integrates with WooCommerce, Pathao courier service, and Meta Ads to provide unified order management, inventory tracking, accounting, and marketing operations.

**Stack:**
- Frontend: React 18 + Next.js 16 with App Router
- Language: TypeScript
- Styling: CSS with CSS Modules (legacy styles.css also present)
- Icons: Lucide React
- Build Tool: Next.js (uses Webpack)
- Package Manager: npm

---

## 🚀 Getting Started

### Step 1: Install Dependencies

```bash
cd /Users/tanzeem/Desktop/SP/ecom
npm install
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual credentials:

```env
# WooCommerce
WOOCOMMERCE_URL=https://your-store.com
WOOCOMMERCE_CONSUMER_KEY=your_key
WOOCOMMERCE_CONSUMER_SECRET=your_secret

# Pathao
PATHAO_BASE_URL=https://api-hermes.pathao.com
PATHAO_CLIENT_ID=your_id
PATHAO_CLIENT_SECRET=your_secret
PATHAO_STORE_ID=your_store_id
PATHAO_SENDER_NAME=Your Business
PATHAO_SENDER_PHONE=01700000000
PATHAO_CITY_ID=1
PATHAO_ZONE_ID=1
PATHAO_AREA_ID=1
```

### Step 3: Run Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

### Step 4: Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure (React Components)

```
components/
├── Layout/
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── Topbar.tsx          # Header with search and actions
│   └── Drawer.tsx          # Slide-out panel for details
│
├── Common/
│   ├── MetricCard.tsx      # KPI display card
│   └── Panel.tsx           # Generic panel wrapper
│
├── Dashboard/
│   ├── OrderPipeline.tsx   # Order stages visualization
│   ├── StockAlerts.tsx     # Inventory warnings
│   └── CashMeter.tsx       # Cash position gauge
│
├── Orders/
│   ├── InboxOrderForm.tsx  # Manual order entry form
│   ├── DispatchSummary.tsx # Pathao dispatch controls
│   └── OrdersTable.tsx     # Orders table with selection
│
└── Views/
    ├── DashboardView.tsx   # Dashboard page
    ├── OrdersView.tsx      # Orders page (main)
    ├── InventoryView.tsx   # Inventory management
    ├── AccountingView.tsx  # Financial ledger
    ├── AdsView.tsx         # Meta Ads campaigns
    └── ScaleOpsView.tsx    # Operations & automations
```

---

## 🔌 API Routes Structure

```
app/api/
├── config/
│   └── status/route.ts           # GET - Check service connectivity
│
├── orders/
│   ├── route.ts                  # GET/POST WooCommerce orders
│   └── inbox/route.ts            # POST - Create order from inbox
│
└── pathao/
    └── orders/
        ├── route.ts              # POST - Bulk Pathao bookings
        └── [consignmentId]/route.ts # GET - Consignment status
```

### API Endpoints

#### `GET /api/config/status`
Check if integrations are configured.

```typescript
Response: {
  woocommerce: boolean,
  pathao: boolean,
  pathaoBookingDefaults: boolean
}
```

#### `GET /api/orders?status=paid&limit=50`
Fetch orders from WooCommerce.

```typescript
Response: {
  orders: CommerceOrder[]
}
```

#### `POST /api/orders/inbox`
Create order from manual inbox entry.

```typescript
Body: {
  name: string,
  phone: string,
  address: string,
  product: string,
  price: number
}

Response: {
  order: CommerceOrder
}
```

#### `POST /api/pathao/orders`
Send orders to Pathao for booking.

```typescript
Body: {
  orderIds: string[]
}

Response: {
  consignments: PathaoConsignment[]
}
```

#### `GET /api/pathao/orders/[consignmentId]`
Get delivery status for specific consignment.

---

## 💻 Component Development Guide

### Creating a New Component

```typescript
// components/MyComponent.tsx
'use client';  // For client-side interactivity

import React from 'react';
import { Panel } from '@/components/Common/Panel';

interface MyComponentProps {
  data: string;
  onAction: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({
  data,
  onAction,
}) => {
  return (
    <Panel title="My Component" subtitle="Description">
      <div>
        <p>{data}</p>
        <button onClick={onAction} type="button">
          Action
        </button>
      </div>
    </Panel>
  );
};
```

### Using Components in Views

```typescript
// components/Views/MyView.tsx
'use client';

import { MyComponent } from '@/components/MyComponent';

export const MyView: React.FC = () => {
  return (
    <section className="view">
      <MyComponent data="test" onAction={() => console.log('clicked')} />
    </section>
  );
};
```

### Adding Navigation

1. Add component to `components/Views/`
2. Add to `viewComponents` map in `app/page.tsx`
3. Update `viewTitles` with label
4. Component automatically appears in sidebar

---

## 📊 Type System

All types are in `lib/types/commerce.ts`:

```typescript
OrderStatus = 'paid' | 'packed' | 'hold' | 'returned'

CommerceOrder {
  id: string              // Unique order ID
  wooId: number          // WooCommerce order number
  source: string         // Order source (WooCommerce, Inbox, API)
  customer: string       // Customer name
  phone: string          // Customer phone
  address: string        // Delivery address
  items: string          // Order line items
  payment: string        // Payment method (COD, Card, etc)
  status: OrderStatus    // Order status
  courier: string        // Courier service (Pathao)
  pathaoStatus: string   // Pathao delivery status
  pathaoConsignment: string // Pathao consignment ID
  payable: number        // COD amount
  total: number          // Order total
  city: string           // Delivery city
  margin: string | number // Profit margin
  notes: string          // Operational notes
}
```

---

## 🔐 Security Best Practices

1. **Never commit `.env.local`** - Add to `.gitignore` ✅
2. **API Keys server-side only** - All credentials in server routes, never exposed to client
3. **Environment validation** - Check required vars exist before using
4. **Authentication** - Implement after MVP (consider NextAuth.js)
5. **Rate limiting** - Add on API routes for production

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Dashboard loads without errors
- [ ] All sidebar nav items load their views
- [ ] Search functionality works
- [ ] Inbox order form validates properly
- [ ] Order table sorting/filtering works
- [ ] Pathao dispatch sends orders
- [ ] All API endpoints respond

### Running Tests

```bash
npm test
```

(Tests need to be configured - create tests in `__tests__/` directory)

---

## 📦 Building & Deployment

### Local Build

```bash
npm run build
npm start
# Runs on http://localhost:3000
```

### Production Deployment

**Vercel (Recommended for Next.js):**

```bash
npm install -g vercel
vercel
```

**Docker:**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**Environment Variables in Deployment:**

Set all `.env.local` variables in your hosting platform's dashboard.

---

## 🐛 Common Issues & Fixes

### Issue: "Module not found: @/components"

**Solution:** Check `tsconfig.json` has proper path alias:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Issue: "Cannot find module 'lucide-react'"

**Solution:** Install lucide-react:

```bash
npm install lucide-react
```

### Issue: API routes return 404

**Solution:** Ensure routes are in `app/api/` directory with `route.ts` filename

### Issue: Styles not loading

**Solution:** Ensure `app/globals.css` and `styles.css` are imported in `app/layout.tsx`

---

## 📚 Useful Resources

- **Next.js Documentation:** https://nextjs.org/docs
- **React Docs:** https://react.dev
- **TypeScript:** https://www.typescriptlang.org/docs
- **Lucide Icons:** https://lucide.dev
- **WooCommerce REST API:** https://woocommerce.com/documentation/plugins/woocommerce/woocommerce-rest-api
- **Pathao API:** https://pathao.com/api-documentation

---

## 👥 Team Collaboration

### Onboarding New Developer

1. Clone repository
2. Run `npm install`
3. Copy `.env.example` to `.env.local` (get values from team)
4. Run `npm run dev`
5. Review `PROJECT_STRUCTURE.md`
6. Open issue for your first feature
7. Create feature branch: `git checkout -b feature/your-feature`
8. Submit PR with description

### Code Standards

- Use TypeScript strictly (no `any` types)
- Prefer functional components with hooks
- Name components with PascalCase
- Use destructuring for props
- Add comments for complex logic
- Keep components under 300 lines
- Extract reusable logic to custom hooks

---

## 📝 Git Workflow

```bash
# Create feature branch
git checkout -b feature/order-filters

# Make changes and commit
git add .
git commit -m "Add order status filters"

# Push to remote
git push origin feature/order-filters

# Create Pull Request on GitHub
# After review and approval, merge to main
```

---

## 🎯 Next Steps

1. **Setup Local Dev:** Complete steps 1-3 above
2. **Integrate WooCommerce:** Update `.env.local` with store credentials
3. **Integrate Pathao:** Add Pathao API credentials
4. **Add Authentication:** Implement user login system
5. **Add Database:** Connect to PostgreSQL for data persistence
6. **Add Tests:** Create test suite for critical paths
7. **Deploy MVP:** Deploy to Vercel or similar

---

## 📞 Support & Questions

- Check existing documentation first
- Review API_DOCUMENTATION.md for detailed endpoint info
- Check QUICK_REFERENCE.md for common commands
- Ask team lead for clarification
- Document solutions in this guide

---

**Last Updated:** May 27, 2026  
**Version:** 1.0.0 MVP  
**Maintained By:** Development Team
