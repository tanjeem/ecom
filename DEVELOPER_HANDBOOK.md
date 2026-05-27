# ThreadOps Commerce OS - Developer Handbook

## 🎯 What This Project Does

ThreadOps is a unified operations dashboard for e-commerce businesses. It's designed to help clothing brands manage:
- **Orders** from WooCommerce, manual inbox entries, and other sources
- **Fulfillment** through Pathao courier integration
- **Inventory** with real-time stock tracking
- **Accounting** with general ledger and reconciliation
- **Marketing** with Meta Ads campaign tracking
- **Operations** with processes and automations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   User Browser                               │
│                  (Next.js Frontend)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│          Next.js Server (App Router)                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  React Components (Client-side state & UI)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                       │                                      │
│  ┌─────────────────────▼──────────────────────────────┐   │
│  │  API Routes (/api/*) - Server-side logic           │   │
│  │  - Integrations with WooCommerce, Pathao          │   │
│  │  - Authentication & validation                     │   │
│  │  - Database queries (future)                       │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────┬──────────────┬──────────────┬──────────────────┘
           │              │              │
           ▼              ▼              ▼
      WooCommerce     Pathao API    Meta Ads API
        REST API      (OAuth 2.0)   (Future)
```

## 📂 Folder Organization

```
ecom/
├── app/
│   ├── api/                    # Server-side API routes
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout wrapper
│   └── page.tsx                # Home page (main dashboard UI)
│
├── components/                 # React components (organized by feature)
│   ├── Layout/                 # Shell components (Sidebar, Topbar, Drawer)
│   ├── Common/                 # Reusable components (MetricCard, Panel)
│   ├── Dashboard/              # Dashboard-specific components
│   ├── Orders/                 # Order management components
│   └── Views/                  # Full page views for each section
│
├── lib/                        # Utilities & shared code
│   ├── types/                  # TypeScript interfaces
│   ├── integrations/           # External service clients
│   └── data/                   # Mock data for development
│
├── public/                     # Static assets
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── next.config.mjs             # Next.js configuration
└── .env.example                # Environment template
```

## 🔄 How Data Flows

### Order Creation Flow

```
User (Inbox Form)
    ↓
Form Data: { name, phone, address, product, price }
    ↓
POST /api/orders/inbox
    ↓
Server Validates & Calls WooCommerce API
    ↓
WooCommerce Creates Order → Returns Order ID
    ↓
Server Creates CommerceOrder Object
    ↓
Returns to Frontend
    ↓
Frontend Updates Order Table
```

### Order Dispatch Flow

```
User Selects Orders + Clicks "Send to Pathao"
    ↓
POST /api/pathao/orders with orderIds
    ↓
Server Iterates Each Order:
  1. Gets OAuth token from Pathao
  2. Formats order for Pathao API
  3. Sends booking request
  4. Gets consignment ID back
    ↓
Server Returns consignment details
    ↓
Frontend Updates order status
    ↓
Orders marked as "Booked" with tracking numbers
```

## 💡 Key Concepts

### Views
A "View" is a full-page section like Dashboard, Orders, Inventory, etc. Each view is a React component in `components/Views/`. The active view is controlled by state in `app/page.tsx`.

### Components
Reusable UI building blocks:
- **Layout Components**: Sidebar, Topbar, Drawer (always visible)
- **Common Components**: MetricCard, Panel (used everywhere)
- **Feature Components**: InboxOrderForm, OrdersTable (specific to a feature)

### Types
TypeScript interfaces that define data structures. All commerce types are in `lib/types/commerce.ts`. Using strict typing prevents bugs.

### API Routes
Server-side functions that:
1. Validate incoming data
2. Call external APIs (WooCommerce, Pathao)
3. Handle errors gracefully
4. Return JSON responses

### Integration Modules
Each external service gets a module in `lib/integrations/`:
- `woocommerce.ts` - WooCommerce API client
- `pathao.ts` - Pathao API client
- `env.ts` - Environment validation

## 🚀 Workflow for Adding a Feature

### Example: Add "Print Label" Button

**Step 1: Design the component**
```typescript
// components/Orders/PrintLabelButton.tsx
interface PrintLabelButtonProps {
  consignmentId: string;
  onPrint: () => void;
}

export const PrintLabelButton: React.FC<PrintLabelButtonProps> = ({
  consignmentId,
  onPrint,
}) => {
  return <button onClick={onPrint}>🖨️ Print Label</button>;
};
```

**Step 2: Add to existing component**
```typescript
// In OrdersTable.tsx, add button for each row
<td>
  <PrintLabelButton 
    consignmentId={order.pathaoConsignment}
    onPrint={() => printLabel(order.pathaoConsignment)}
  />
</td>
```

**Step 3: Create API route (if needed)**
```typescript
// app/api/pathao/labels/[consignmentId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { consignmentId: string } }
) {
  try {
    const label = await pathaoFetch(
      `/orders/${params.consignmentId}/label`,
      { method: 'GET' }
    );
    return Response.json({ label });
  } catch (error) {
    return Response.json({ error: 'Label fetch failed' }, { status: 500 });
  }
}
```

**Step 4: Handle in component**
```typescript
const handlePrintLabel = async () => {
  const response = await fetch(
    `/api/pathao/labels/${consignmentId}`
  );
  const data = await response.json();
  // Open label in new window or download
  window.open(data.label.pdf_url, '_blank');
};
```

**Step 5: Test**
- Check button appears in table
- Verify click triggers API call
- Confirm label opens/downloads

## 🔗 Integration Patterns

### WooCommerce Integration
```typescript
// Get orders
const orders = await getWooOrders({ status: 'processing', limit: 50 });

// Create order
const newOrder = await createWooOrder({
  name: 'Customer Name',
  phone: '+8801700000000',
  address: 'Dhaka, Bangladesh',
  product: 'Blue Shirt M',
  price: 2450
});
```

### Pathao Integration
```typescript
// Get OAuth token (cached per request)
const token = await getPathaoToken();

// Create shipment
const consignment = await createPathaoOrder({
  recipient_name: 'Customer',
  recipient_phone: '01700000000',
  recipient_address: 'Dhaka',
  cod_amount: 2450
});

// Check status
const status = await getPathaoStatus(consignmentId);
```

## 🎨 UI Patterns

### Panel Component
```typescript
<Panel 
  title="Section Title"
  subtitle="Optional description"
  className="wide-panel"
  actions={<button>Action</button>}
>
  {/* Content */}
</Panel>
```

### Metric Card
```typescript
<MetricCard
  label="Today sales"
  value="$18,420"
  subtitle="+18.4% vs yesterday"
  sentiment="positive"  // or 'warning' or 'negative'
/>
```

### Status Badges
```typescript
<span className="status-pill paid">Paid</span>
<span className="status-pill packed">Packed</span>
<span className="status-pill critical">On Hold</span>
```

## 📝 Code Style Guide

### Component Names
```typescript
// ✅ Good - Descriptive, PascalCase
export const OrdersTable = () => {};
export const InboxOrderForm = () => {};
export const DispatchSummary = () => {};

// ❌ Avoid - Too generic or unclear
export const Table = () => {};
export const Form = () => {};
export const Component = () => {};
```

### Props Interface
```typescript
// ✅ Good
interface OrdersTableProps {
  orders: CommerceOrder[];
  selectedOrders: string[];
  onSelectionChange: (orderId: string, selected: boolean) => void;
  onOrderClick: (order: CommerceOrder) => void;
}

// ❌ Avoid - Using 'any'
interface OrdersTableProps {
  orders: any;
  onSelectionChange: (data: any) => void;
}
```

### API Route Structure
```typescript
// ✅ Good - Clear error handling
export async function POST(request: Request) {
  try {
    const data = await request.json();
    validateData(data);  // Throw if invalid
    const result = await externalAPI(data);
    return Response.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}

// ❌ Avoid - Silent failures
export async function POST(request: Request) {
  const data = await request.json();
  const result = await externalAPI(data);  // No error handling
  return Response.json(result);
}
```

## 🧰 Common Tasks

### Add a New Page View

1. Create component in `components/Views/{ViewName}View.tsx`
2. Make it `'use client'` if interactive
3. Add to `viewComponents` map in `app/page.tsx`
4. Add to `viewTitles` map
5. Sidebar automatically includes it

### Update API Route Response

1. Find route file in `app/api/`
2. Modify response JSON structure
3. Update TypeScript interface if needed
4. Update frontend component expecting the data

### Add Database Query

1. Install database client: `npm install @prisma/client` (for example)
2. Create schema in `prisma/schema.prisma`
3. Generate client: `npx prisma generate`
4. Use in API route:

```typescript
import { prisma } from '@/lib/db';

const orders = await prisma.order.findMany();
```

### Add Authentication

Use NextAuth.js (recommended for Next.js):

```bash
npm install next-auth
```

Then wrap routes with authentication middleware.

## 🐞 Debugging Tips

### Browser Console
- Check for React errors
- Verify API calls in Network tab
- Use browser DevTools Profiler to find slow renders

### Server Logs
```bash
# Watch for errors in terminal running npm run dev
# Add console.log() in API routes to debug
console.log('Processing order:', orderId);
```

### Type Errors
- Hover over red squiggles in VS Code
- Run `npm run typecheck` to catch all TypeScript errors
- Check that all data matches type definitions

### API Debugging
```bash
# Test endpoint from command line
curl -X POST http://localhost:3000/api/orders/inbox \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"01700000000",...}'
```

## 📊 Performance Tips

1. **Lazy Load Heavy Components**
   ```typescript
   const HeavyComponent = dynamic(() => import('./HeavyComponent'));
   ```

2. **Memoize Components**
   ```typescript
   export const MyComponent = React.memo(MyComponentContent);
   ```

3. **Optimize Re-renders**
   ```typescript
   // Use useMemo for expensive calculations
   const filteredOrders = useMemo(() => {
     return orders.filter(o => o.status === 'paid');
   }, [orders]);
   ```

4. **Server-side Pagination**
   - Don't load all orders at once
   - Load pages on demand

## 🔒 Security Checklist

- [ ] No API keys in client-side code
- [ ] All credentials in `.env.local` (never in git)
- [ ] Input validation on API routes
- [ ] HTTPS in production
- [ ] CORS properly configured
- [ ] Rate limiting on API endpoints
- [ ] User authentication implemented
- [ ] Permission checks before database mutations

## 📚 Learning Resources

**For This Project:**
- Read `PROJECT_STRUCTURE.md` for architecture overview
- Read `API_DOCUMENTATION.md` for endpoint details
- Read `QUICK_REFERENCE.md` for common commands

**External:**
- Next.js docs: https://nextjs.org/docs
- React docs: https://react.dev
- TypeScript: https://www.typescriptlang.org/docs

---

**Happy coding! 🎉**
