# ThreadOps Commerce OS - Component Guide

A complete reference for all React components in the application.

## Layout Components

### Sidebar
Navigation sidebar with view switching.

**Location:** `components/Layout/Sidebar.tsx`

**Props:**
```tsx
interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}
```

**Usage:**
```tsx
<Sidebar 
  activeView="dashboard" 
  onNavigate={(view) => setActiveView(view)} 
/>
```

**Features:**
- 6 main navigation items (Dashboard, Orders, Inventory, Accounting, Ads, Scale Ops)
- Active state highlighting
- Sync status indicator
- Lucide icons for each section

---

### Topbar
Header with title, search, notifications, and new order button.

**Location:** `components/Layout/Topbar.tsx`

**Props:**
```tsx
interface TopbarProps {
  title: string;
  onSearch: (query: string) => void;
}
```

**Usage:**
```tsx
<Topbar 
  title="Orders"
  onSearch={(query) => handleSearch(query)}
/>
```

**Features:**
- Page title display
- Global search field
- Notifications button
- New Order CTA button

---

### Drawer
Slide-out side panel for details and forms.

**Location:** `components/Layout/Drawer.tsx`

**Props:**
```tsx
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  content?: React.ReactNode;
  title?: string;
}
```

**Usage:**
```tsx
<Drawer
  isOpen={isDrawerOpen}
  onClose={() => setIsDrawerOpen(false)}
  title="Order Details"
  content={<OrderDetails order={selectedOrder} />}
/>
```

**Features:**
- Smooth open/close animation
- Header with title and close button
- Custom content area
- Accessibility labels

---

## Common Components

### MetricCard
KPI card displaying a metric with value and trend.

**Location:** `components/Common/MetricCard.tsx`

**Props:**
```tsx
interface MetricCardProps {
  label: string;
  value: string;
  subtitle: string;
  sentiment?: 'positive' | 'warning' | 'negative';
}
```

**Usage:**
```tsx
<MetricCard
  label="Today sales"
  value="$18,420"
  subtitle="+18.4% vs yesterday"
  sentiment="positive"
/>
```

**Sentiment Styling:**
- `positive` - Green text for good metrics
- `warning` - Orange text for caution
- `negative` - Red text for alerts
- (none) - Gray text for neutral

---

### Panel
Container component for content sections with header.

**Location:** `components/Common/Panel.tsx`

**Props:**
```tsx
interface PanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}
```

**Usage:**
```tsx
<Panel
  title="Order Pipeline"
  subtitle="Live handoff from payment to fulfillment."
  className="wide-panel"
  actions={<button>Refresh</button>}
>
  <OrderPipeline stages={stages} />
</Panel>
```

**Features:**
- Flexible header with title and optional subtitle
- Optional action buttons area
- Custom className support
- Clean styling with subtle borders

---

## Dashboard Components

### OrderPipeline
Visualizes order progression through stages.

**Location:** `components/Dashboard/OrderPipeline.tsx`

**Props:**
```tsx
interface OrderPipelineProps {
  stages: { name: string; count: number }[];
}
```

**Usage:**
```tsx
<OrderPipeline 
  stages={[
    { name: 'Paid', count: 342 },
    { name: 'Packed', count: 128 },
    { name: 'Ready', count: 71 },
    { name: 'Dispatched', count: 45 },
  ]}
/>
```

**Features:**
- Horizontal bar display for each stage
- Count and percentage calculation
- Responsive grid layout

---

### StockAlerts
Shows low inventory warnings.

**Location:** `components/Dashboard/StockAlerts.tsx`

**Props:**
```tsx
interface StockAlertsProps {
  alerts: StockAlertItem[];
}

interface StockAlertItem {
  sku: string;
  product: string;
  current: number;
  reorderPoint: number;
}
```

**Usage:**
```tsx
<StockAlerts
  alerts={[
    {
      sku: 'BLS-M-BK',
      product: 'Black Linen Shirt M',
      current: 12,
      reorderPoint: 20,
    },
  ]}
/>
```

**Features:**
- Red alert styling
- SKU and product name
- Current vs reorder point comparison
- Empty state handling

---

### CashMeter
Displays cash position and obligations.

**Location:** `components/Dashboard/CashMeter.tsx`

**Props:**
```tsx
interface CashMeterProps {
  available: number;
  obligations: number;
  surplus: number;
  currency?: string;
}
```

**Usage:**
```tsx
<CashMeter
  available={96300}
  obligations={37940}
  surplus={58360}
  currency="$"
/>
```

**Features:**
- Visual progress bar
- Three-row breakdown
- Automatic percentage calculation
- Currency customization

---

## Order Management Components

### OrdersTable
Displays orders in a filterable table.

**Location:** `components/Orders/OrdersTable.tsx`

**Props:**
```tsx
interface OrdersTableProps {
  orders: CommerceOrder[];
  selectedOrders: string[];
  onSelectionChange: (orderId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOrderClick: (order: CommerceOrder) => void;
}
```

**Usage:**
```tsx
<OrdersTable
  orders={orders}
  selectedOrders={selectedOrders}
  onSelectionChange={(id, selected) => updateSelection(id, selected)}
  onSelectAll={(selected) => selectAll(selected)}
  onOrderClick={(order) => showOrderDetails(order)}
/>
```

**Features:**
- Checkbox selection
- Select all functionality
- Click to expand details
- 10-column display (Order ID, Source, Customer, Items, Payment, Status, Pathao Status, Payable, Total)

---

### InboxOrderForm
Form for pasting and creating orders from inbox messages.

**Location:** `components/Orders/InboxOrderForm.tsx`

**Props:**
```tsx
interface InboxOrderFormProps {
  onSubmit: (data: InboxOrderData) => void;
  isLoading?: boolean;
  status?: 'draft' | 'pending' | 'success' | 'error';
}

interface InboxOrderData {
  name: string;
  phone: string;
  address: string;
  product: string;
  price: number;
}
```

**Usage:**
```tsx
<InboxOrderForm
  onSubmit={(data) => createOrder(data)}
  isLoading={isLoading}
  status={status}
/>
```

**Features:**
- Text area for pasting raw order info
- Smart parsing button
- Individual fields for verification
- Status indicator (draft/pending/success/error)
- Auto-parse from pasted text

---

### DispatchSummary
Shows courier dispatch status and actions.

**Location:** `components/Orders/DispatchSummary.tsx`

**Props:**
```tsx
interface DispatchSummaryProps {
  selectedCount: number;
  readyCount: number;
  totalPayable: number;
  onSyncWooCommerce: () => void;
  onBulkSendPathao: () => void;
  isLoading?: boolean;
}
```

**Usage:**
```tsx
<DispatchSummary
  selectedCount={5}
  readyCount={71}
  totalPayable={12500}
  onSyncWooCommerce={() => syncWoo()}
  onBulkSendPathao={() => sendToPathao()}
  isLoading={false}
/>
```

**Features:**
- Summary metrics display
- Sync WooCommerce button
- Bulk Pathao dispatch button
- Dispatch log display
- Loading state handling

---

## View Components

### DashboardView
Main dashboard with KPIs and key metrics.

**Location:** `components/Views/DashboardView.tsx`

**Features:**
- 4 KPI cards at top
- Order pipeline visualization
- Stock alerts
- Cash position meter
- All contained in responsive grid layout

---

### OrdersView
Order management and dispatch interface.

**Location:** `components/Views/OrdersView.tsx`

**Features:**
- Integration card strip
- Inbox order form
- Dispatch summary
- Order filtering
- Orders table with selection
- Actions toolbar

---

### InventoryView
Stock matrix and demand forecasting.

**Location:** `components/Views/InventoryView.tsx`

**Features:**
- Color and size matrix
- Stock levels by variant
- Demand forecast with progress bars
- Reorder indicators
- Current vs weekly demand

---

### AccountingView
Financial reports and reconciliation.

**Location:** `components/Views/AccountingView.tsx`

**Features:**
- Revenue, COGS, expenses, profit KPIs
- General ledger table
- Double-entry transaction display
- Reconciliation list
- Channel-specific tracking

---

### AdsView
Meta Ads campaign management and tracking.

**Location:** `components/Views/AdsView.tsx`

**Features:**
- Campaign performance table
- ROAS and CPA tracking
- Creative library
- Fatigue indicators
- Scale/pause/stop actions

---

### ScaleOpsView
Operations setup and automation.

**Location:** `components/Views/ScaleOpsView.tsx`

**Features:**
- Operating system processes grid
- Quality control, returns, support, suppliers
- Automation rules list
- On/off toggle indicators
- Rule descriptions

---

## Type Definitions

All component props extend the following base types:

```typescript
// From lib/types/commerce.ts

type OrderStatus = "paid" | "packed" | "hold" | "returned";

type CommerceOrder = {
  id: string;
  wooId: number;
  source: string;
  customer: string;
  phone: string;
  address: string;
  items: string;
  payment: string;
  status: OrderStatus;
  courier: string;
  pathaoStatus: string;
  pathaoConsignment: string;
  payable: number;
  total: number;
  city: string;
  margin: string;
  notes: string;
};

type InboxOrderInput = {
  name: string;
  phone: string;
  address: string;
  product: string;
  price: number;
  productId?: number;
  variationId?: number;
  quantity?: number;
  city?: string;
};
```

---

## Styling

All components use CSS from `app/globals.css`:

- **Colors**: Professional blues, grays, greens, reds
- **Spacing**: Consistent padding/margin system
- **Typography**: Clean sans-serif font
- **Responsive**: Mobile-first approach
- **Icons**: Lucide React (20-24px standard size)

### CSS Classes Used:
- `.app-shell` - Main container
- `.sidebar` - Left navigation
- `.workspace` - Main content area
- `.topbar` - Header bar
- `.metric-card` - KPI display
- `.panel` - Content container
- `.table-wrap` - Table styling
- `.drawer` - Slide-out panel
- `.nav-item` - Navigation button
- `.primary-action` - Main button
- `.secondary-action` - Secondary button
- `.icon-button` - Small icon-only button

---

## Best Practices

1. **Always import from `@/components`** - Use path aliases
2. **Memoize expensive components** - Use `React.memo()` for large lists
3. **Type all props** - No implicit `any` types
4. **Handle loading states** - Show spinners/disabled buttons
5. **Provide fallbacks** - Empty states, error boundaries
6. **Keep components focused** - Single responsibility principle
7. **Use 'use client'** - Mark interactive components
8. **Prop drilling** - Consider context for deeply nested props

---

**Last Updated:** May 27, 2026
**Maintained By:** Development Team
