# ThreadOps Commerce OS - Developer Setup Guide

## 🚀 Quick Start

This guide walks you through setting up ThreadOps Commerce OS locally for development.

### Prerequisites
- **Node.js**: v20.9.0 or higher (currently v20.0.0, will work but may have warnings)
- **npm**: v9.0.0 or higher
- **Git**: For version control
- **Code Editor**: VS Code recommended

### 1. Clone & Install

```bash
cd /Users/tanzeem/Desktop/SP/ecom
npm install
```

The dependencies will be installed:
- **next**: React framework with server-side capabilities
- **react** & **react-dom**: UI library
- **lucide-react**: Icon library
- **typescript**: Type safety
- **eslint**: Code linting

### 2. Environment Configuration

Copy the example environment file and add your credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual API credentials:

**For WooCommerce:**
- Get your credentials from: WooCommerce → Settings → Advanced → REST API
- Required fields:
  - `WOOCOMMERCE_URL`: Your store domain (e.g., https://mystore.com)
  - `WOOCOMMERCE_CONSUMER_KEY`: API key
  - `WOOCOMMERCE_CONSUMER_SECRET`: API secret

**For Pathao:**
- Get credentials from: Pathao Developer Console
- Required fields:
  - `PATHAO_CLIENT_ID`: OAuth Client ID
  - `PATHAO_CLIENT_SECRET`: OAuth Client Secret
  - `PATHAO_STORE_ID`: Your Pathao store ID
  - `PATHAO_CITY_ID`, `PATHAO_ZONE_ID`, `PATHAO_AREA_ID`: Default pickup location

### 3. Start Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

The server uses Turbopack for fast development builds.

### 4. Verify Configuration

Once the dev server is running, navigate to the application and check the status indicator in the sidebar. It should show:
- ✓ Connected to WooCommerce
- ✓ Connected to Pathao
- ✓ Booking defaults configured

## 📁 Project Structure

### `/app` - Next.js Application
- `layout.tsx` - Root layout (metadata, styles)
- `page.tsx` - Main page component with view routing
- `/api` - Server-side API routes

### `/components` - React Components
- `/Layout` - Navigation and structure
  - `Sidebar.tsx` - Navigation sidebar
  - `Topbar.tsx` - Header with search
  - `Drawer.tsx` - Side panel for details
- `/Common` - Reusable components
  - `MetricCard.tsx` - KPI display
  - `Panel.tsx` - Container component
- `/Dashboard` - Dashboard section
  - `OrderPipeline.tsx` - Flow visualization
  - `StockAlerts.tsx` - Inventory warnings
  - `CashMeter.tsx` - Cash position tracker
- `/Orders` - Order management
  - `OrdersTable.tsx` - Order list
  - `InboxOrderForm.tsx` - Manual order entry
  - `DispatchSummary.tsx` - Courier summary
- `/Views` - Page sections
  - `DashboardView.tsx` - Main dashboard
  - `OrdersView.tsx` - Order queue
  - `InventoryView.tsx` - Stock matrix
  - `AccountingView.tsx` - Financial reports
  - `AdsView.tsx` - Meta Ads tracking
  - `ScaleOpsView.tsx` - Operations setup

### `/lib` - Utilities & Configuration
- `/types/commerce.ts` - TypeScript interfaces
- `/integrations/` - External API clients
  - `woocommerce.ts` - WooCommerce API
  - `pathao.ts` - Pathao delivery API
  - `env.ts` - Environment validation
- `/data/mock.ts` - Sample data for testing

### `/public` - Static Assets
- Images, icons, and other static files

## 🔄 Development Workflow

### Running the Dev Server
```bash
npm run dev
```

### Building for Production
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

## 🧩 Component Usage Examples

### Using the MetricCard
```tsx
import { MetricCard } from '@/components/Common';

<MetricCard
  label="Today sales"
  value="$18,420"
  subtitle="+18.4% vs yesterday"
  sentiment="positive"
/>
```

### Using the Panel
```tsx
import { Panel } from '@/components/Common';

<Panel
  title="Order Pipeline"
  subtitle="Live handoff from payment to fulfillment."
  className="wide-panel"
>
  <OrderPipeline stages={stages} />
</Panel>
```

## 🔌 API Integration Examples

### Fetching WooCommerce Orders
```tsx
const response = await fetch('/api/orders?status=processing');
const data = await response.json();
console.log(data.orders);
```

### Creating an Order from Inbox
```tsx
const response = await fetch('/api/orders/inbox', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Ayesha Khan',
    phone: '01700000000',
    address: 'Banani, Dhaka',
    product: 'Black Linen Shirt M',
    price: 2450
  })
});
const data = await response.json();
```

### Sending Orders to Pathao
```tsx
const response = await fetch('/api/pathao/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderIds: ['#12345', '#12346']
  })
});
```

## 🐛 Troubleshooting

### Dev Server Won't Start
- Check Node.js version: `node --version` (should be v20.9.0+)
- Clear cache: `rm -rf .next && npm run dev`
- Check for port conflicts: Port 3000 should be available

### Can't Connect to WooCommerce
- Verify `WOOCOMMERCE_URL` doesn't have trailing slash
- Check Basic Auth credentials (check WooCommerce REST API settings)
- Ensure store allows API access from localhost

### Pathao Orders Failing
- Verify all required fields in `.env.local` are filled
- Check store ID, city ID, zone ID, area ID are correct
- Ensure OAuth token credentials are valid

### TypeScript Errors
- Run `npm run typecheck` to see all type issues
- Check that all imports use correct paths with `@/` alias
- Ensure `.env.local` has all required variables

## 📝 Adding New Components

### Step 1: Create Component File
Create `components/YourSection/YourComponent.tsx`:

```tsx
'use client';

import React from 'react';

interface YourComponentProps {
  title: string;
}

export const YourComponent: React.FC<YourComponentProps> = ({ title }) => {
  return <div>{title}</div>;
};
```

### Step 2: Import & Use
```tsx
import { YourComponent } from '@/components/YourSection/YourComponent';

<YourComponent title="Example" />
```

## 🔐 Security Best Practices

- **Never commit `.env.local`** - It's in `.gitignore`
- **Credentials server-side only** - API keys never sent to browser
- **Use HTTPS in production** - Especially for API calls
- **Validate inputs** - Both client and server side
- **Rotate credentials regularly** - Check WooCommerce & Pathao settings

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [WooCommerce REST API](https://woocommerce.com/documentation/plugins/woocommerce/woocommerce-rest-api/)
- [Pathao API Docs](https://pathao.com/api-documentation)

## 💡 Tips for Developers

1. **Use React DevTools** - Browser extension for debugging components
2. **Enable TypeScript strict mode** - Catch more errors early
3. **Use Next.js Image component** - For optimized images
4. **Leverage Lucide icons** - Search at lucide.dev
5. **Test locally before deployment** - Use `npm run build` to test prod build

## 🚀 Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Configure environment: `cp .env.example .env.local` and fill credentials
3. ✅ Start dev server: `npm run dev`
4. ✅ Verify all integrations work (check sidebar sync status)
5. ✅ Make your first component
6. ✅ Deploy to production with `npm run build`

---

**Need Help?** Check PROJECT_STRUCTURE.md for architecture details or INTEGRATION_GUIDE.md for API specifics.
