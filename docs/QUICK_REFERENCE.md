# Developer Quick Reference

## Files at a Glance

| File | Purpose | Key Exports |
|------|---------|-------------|
| `lib/types/commerce.ts` | TypeScript types | `CommerceOrder`, `InboxOrderInput`, `OrderStatus` |
| `lib/integrations/woocommerce.ts` | WooCommerce API | `getWooOrders()`, `createWooOrder()`, `wooFetch()` |
| `lib/integrations/pathao.ts` | Pathao API | `createPathaoOrder()`, `getPathaoToken()`, `pathaoFetch()` |
| `lib/integrations/env.ts` | Env validation | `hasEnv()`, `requiredWooEnv`, `requiredPathaoEnv` |
| `app/api/orders/route.ts` | GET orders API | Calls `getWooOrders()` |
| `app/api/orders/inbox/route.ts` | POST inbox order | Calls `createWooOrder()` |
| `app/api/pathao/orders/route.ts` | POST Pathao orders | Calls `createPathaoOrder()` |
| `app/api/pathao/orders/[consignmentId]/route.ts` | GET Pathao status | Calls `getPathaoStatus()` |
| `app/api/config/status/route.ts` | Config check | Validates credentials |
| `index.html` | UI (legacy) | Dashboard, Orders, Inventory, etc. |
| `app.js` | Frontend logic (legacy) | Event handlers, form parsing |
| `styles.css` | Styling | Component styles |

## Common Tasks

### Add a New API Endpoint

**1. Create route file**
```typescript
// app/api/myfeature/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ data: 'result' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Your logic here
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 400 }
    );
  }
}
```

**2. Call from frontend**
```javascript
const response = await fetch('/api/myfeature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* data */ })
});
const data = await response.json();
```

### Add a New Integration Service

**1. Create integration file**
```typescript
// lib/integrations/newservice.ts
import { hasEnv } from './env';

const requiredNewServiceEnv = [
  'NEWSERVICE_API_KEY',
  'NEWSERVICE_BASE_URL'
];

async function newServiceFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!hasEnv(requiredNewServiceEnv)) {
    throw new Error('NewService credentials are not configured');
  }

  const response = await fetch(
    `${process.env.NEWSERVICE_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        'Authorization': `Bearer ${process.env.NEWSERVICE_API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      }
    }
  );

  if (!response.ok) {
    throw new Error(`NewService request failed: ${response.status}`);
  }

  return response.json();
}

export async function getNewServiceData() {
  return newServiceFetch('/data');
}
```

**2. Update `.env.example`**
```env
NEWSERVICE_API_KEY=your_key
NEWSERVICE_BASE_URL=https://api.newservice.com
```

**3. Update `lib/integrations/env.ts`**
```typescript
export const requiredNewServiceEnv = [
  'NEWSERVICE_API_KEY',
  'NEWSERVICE_BASE_URL'
];
```

### Handle an Error in an Integration

```typescript
// Pattern to follow
try {
  const result = await someIntegration();
  return result;
} catch (error) {
  if (error instanceof Error) {
    // Log for debugging
    console.error('Integration failed:', error.message);
    
    // Re-throw with context
    throw new Error(`Detailed context: ${error.message}`);
  }
  
  // Unknown error
  throw new Error('Unknown integration error');
}
```

### Test an API Endpoint Locally

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Make request
curl -X GET http://localhost:3000/api/orders

# Or for POST
curl -X POST http://localhost:3000/api/orders/inbox \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"01700000000","address":"Dhaka","product":"Item","price":500}'

# Check response and debug
echo $?  # 0 = success
```

### Debug Type Errors

```bash
# Check all type errors
npm run typecheck

# In VS Code: Problems panel (Cmd+Shift+M on Mac)
# Shows line number and exact type mismatch
```

### Add a New Type

**1. Add to `lib/types/commerce.ts`**
```typescript
export type NewType = {
  id: string;
  name: string;
  // ... fields
};
```

**2. Import where needed**
```typescript
import type { NewType } from '@/lib/types/commerce';

const item: NewType = { id: '1', name: 'Example' };
```

### Handle Missing Environment Variables

```typescript
// lib/integrations/env.ts
import { hasEnv, requiredWooEnv } from './env';

// In route or integration function:
if (!hasEnv(requiredWooEnv)) {
  throw new Error('WooCommerce is not configured. Check .env.local');
}
```

---

## Debugging Tips

### View Request/Response Logs

**In integration function:**
```typescript
console.log('Request URL:', endpoint);
console.log('Request headers:', options.headers);
const response = await fetch(url, options);
console.log('Response status:', response.status);
const data = await response.json();
console.log('Response data:', data);
return data;
```

**View logs:**
```bash
# Terminal where `npm run dev` is running
# Look for console.log output
```

### Check Environment Variables

```bash
# In terminal
node -e "console.log(process.env.WOOCOMMERCE_URL)"

# Output should show the value, or undefined if not set
```

### Inspect WooCommerce Response

```typescript
// In woocommerce.ts, add logging:
console.log('WooCommerce response:', JSON.stringify(data, null, 2));
```

### Test Credentials with curl

```bash
# WooCommerce
curl -u "your_key:your_secret" \
  "https://store.com/wp-json/wc/v3/orders?limit=1"

# Pathao token
curl -X POST https://api-hermes.pathao.com/aladdin/api/v1/issue-token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"ID","client_secret":"SECRET","grant_type":"client_credentials"}'
```

### Check Type Safety

```typescript
// This will show errors in VS Code and CLI:
const order: CommerceOrder = {
  id: 123,  // ERROR: number is not string
  // Missing required fields will also error
};
```

---

## Code Patterns

### Safe Error Handling Pattern

```typescript
export async function safeOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${context} failed: ${message}`);
    throw new Error(`${context}: ${message}`);
  }
}

// Usage:
const orders = await safeOperation(
  () => getWooOrders(params),
  'WooCommerce sync'
);
```

### Validation Pattern

```typescript
function validateInboxInput(input: unknown): InboxOrderInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input must be an object');
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.name !== 'string' || obj.name.length < 2) {
    throw new Error('Name required, min 2 characters');
  }

  if (typeof obj.phone !== 'string' || !/^01\d{9}$/.test(obj.phone)) {
    throw new Error('Invalid phone number');
  }

  // Validate other fields...

  return obj as InboxOrderInput;
}
```

### API Response Pattern

```typescript
// Success
return NextResponse.json({
  orders: [...],
  message: 'Orders synced successfully'
});

// Error
return NextResponse.json(
  { error: 'Descriptive error message' },
  { status: 400 }
);

// Partial success
return NextResponse.json({
  consignments: [
    { orderId: '#1', error: null, consignmentId: '...' },
    { orderId: '#2', error: 'Phone invalid', consignmentId: null }
  ]
});
```

---

## Performance Optimization

### Current Bottlenecks

1. **Pathao token generation** - New token per request
   - Fix: Redis cache with 30-minute TTL

2. **WooCommerce pagination** - Fetches first page only
   - Fix: Implement cursor-based pagination

3. **Order formatting** - Linear mapping of responses
   - Fix: Minimal impact, but could batch process

### Quick Wins

```typescript
// Add request deduplication:
const requestCache = new Map<string, Promise<any>>();

export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (requestCache.has(key)) {
    return requestCache.get(key);
  }
  
  const promise = fetcher().finally(() => requestCache.delete(key));
  requestCache.set(key, promise);
  return promise;
}
```

---

## Testing Checklist

Before committing code:

- [ ] Run `npm run typecheck` - all types valid
- [ ] Run `npm run lint` - no linting issues
- [ ] Test endpoint with curl or Postman
- [ ] Check .env.local has required variables
- [ ] Verify error messages are helpful
- [ ] Test error paths (invalid input, service down)
- [ ] Check console for unexpected logs

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run typecheck       # Check types
npm run lint            # Check for lint issues

# Building
npm run build           # Build for production
npm start               # Start production server

# Debugging
node -e "console.log(process.env.VAR_NAME)"  # Check env var
npm run typecheck -- --pretty  # Pretty format errors

# Git
git status              # See changed files
git diff                # See changes
git add .               # Stage all changes
git commit -m "message" # Commit with message
git push                # Push to remote
```

---

## Folder Navigation

```
ecom/
├── app/                    # ← API routes go here
│   └── api/
│       └── [feature]/
│           └── route.ts   # ← New endpoint
│
├── lib/
│   ├── types/             # ← New types go here
│   │   └── commerce.ts
│   └── integrations/       # ← New services go here
│       ├── woocommerce.ts
│       ├── pathao.ts
│       └── env.ts
│
└── app/
    ├── page.tsx           # ← React components (future)
    ├── layout.tsx
    └── globals.css

# Root files - don't move
index.html               # Legacy HTML (reference)
app.js                   # Legacy JS (reference)
styles.css              # Styles
package.json            # Dependencies
tsconfig.json           # TypeScript config
.env.local              # Environment (secret, don't commit)
```

---

## Adding a Feature Checklist

1. **Type Definition**
   - [ ] Add types to `lib/types/commerce.ts`

2. **Integration/Logic**
   - [ ] Create function in appropriate `lib/integrations/*.ts`
   - [ ] Add error handling
   - [ ] Add validation

3. **API Route**
   - [ ] Create `app/api/feature/route.ts`
   - [ ] Implement GET, POST, etc. as needed
   - [ ] Add error handling
   - [ ] Test with curl

4. **Environment**
   - [ ] Add required vars to `.env.example`
   - [ ] Update `lib/integrations/env.ts` if needed

5. **Documentation**
   - [ ] Add endpoint to `API_DOCUMENTATION.md`
   - [ ] Add function to appropriate guide

6. **Testing**
   - [ ] Run typecheck
   - [ ] Run lint
   - [ ] Test endpoint locally
   - [ ] Commit with clear message

---

## Getting Help

1. **Check docs first:**
   - `PROJECT_STRUCTURE.md` - Overview of project
   - `INTEGRATION_GUIDE.md` - How integrations work
   - `API_DOCUMENTATION.md` - All endpoints
   - `SETUP_DEPLOYMENT.md` - Setup issues

2. **Search for similar code:**
   - Check how `woocommerce.ts` or `pathao.ts` work
   - Look for error handling patterns
   - Check existing tests

3. **Debug systematically:**
   - Add console.log statements
   - Test API with curl first
   - Check .env.local is set correctly
   - Run typecheck for type issues

4. **Read error messages carefully:**
   - Often tells you exactly what's wrong
   - Check stack trace for where error occurred

