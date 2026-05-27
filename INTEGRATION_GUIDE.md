# Integration Developer Guide

## WooCommerce Integration

### Overview
The WooCommerce integration (`lib/integrations/woocommerce.ts`) handles synchronization of orders and creation of new orders from inbox entries.

### Authentication
Uses HTTP Basic Authentication with Consumer Key and Secret.

```typescript
// Format: key:secret in base64
Authorization: Basic base64(key:secret)
```

### Main Functions

#### `getWooOrders(searchParams)`
Fetches orders from WooCommerce with optional filtering.

```typescript
// Example: Fetch all paid orders
const orders = await getWooOrders(
  new URLSearchParams({ status: 'processing' })
);

// URL Params:
// - status: payment status (processing, completed, on-hold, etc.)
// - limit: items per page (default 10)
// - page: page number (default 1)
```

**Returns:** `CommerceOrder[]`

**Data Mapping:**
- `WooOrder.id` → `CommerceOrder.wooId`
- `WooOrder.billing.first_name + last_name` → `CommerceOrder.customer`
- `WooOrder.total` → `CommerceOrder.total`
- Parses `WooOrder.meta_data` for Pathao consignment info

#### `createWooOrder(input)`
Creates a new order in WooCommerce from inbox entry.

```typescript
const input: InboxOrderInput = {
  name: "Ayesha Khan",
  phone: "01700000000",
  address: "Banani, Dhaka",
  product: "Black Linen Shirt M",
  price: 2450,
  productId: 42,        // Optional: WooCommerce product ID
  variationId: 123,     // Optional: For variants
  quantity: 1,          // Optional: Default 1
  city: "Dhaka"         // Optional: For lookup
};

const order = await createWooOrder(input);
```

**Returns:** `CommerceOrder` (newly created)

**Process:**
1. Validates input fields
2. Looks up product by name or ID
3. Creates order with customer details
4. Sets payment method based on context
5. Returns formatted order object

#### `wooFetch(endpoint, options)`
Internal HTTP client with auth and error handling.

```typescript
// GET request
const response = await wooFetch<WooOrder[]>('/orders', {
  method: 'GET',
  // Extra query params in endpoint URL
});

// POST request
const response = await wooFetch<WooOrder>('/orders', {
  method: 'POST',
  body: JSON.stringify(orderData),
});
```

### Error Handling

```typescript
try {
  const orders = await getWooOrders(params);
} catch (error) {
  if (error instanceof Error) {
    console.error('WooCommerce sync failed:', error.message);
    // Likely causes:
    // - Invalid credentials in .env.local
    // - WooCommerce store offline
    // - Store doesn't have WooCommerce REST API enabled
  }
}
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid credentials | Check `WOOCOMMERCE_CONSUMER_KEY` and `WOOCOMMERCE_CONSUMER_SECRET` |
| 404 Not Found | Wrong base URL | Ensure `WOOCOMMERCE_URL` ends without `/` |
| Empty orders | Store has no orders | Create test orders in WooCommerce dashboard |
| Mapping errors | Missing order fields | Order must have billing/shipping address and customer name |

---

## Pathao Integration

### Overview
The Pathao integration (`lib/integrations/pathao.ts`) handles shipping order creation and status tracking.

### Authentication
Uses OAuth 2.0 Bearer token authentication.

```typescript
// Token flow:
1. POST /aladdin/api/v1/issue-token with credentials
2. Receive access_token
3. Use in subsequent requests: Authorization: Bearer token
```

**Supported Grant Types:**
- `client_credentials` - Default (recommend)
- `password` - Username/password if credentials provided

### Main Functions

#### `getPathaoToken()`
Internal function that retrieves and caches OAuth token.

```typescript
// Automatically called by pathaoFetch()
// Handles token refresh per request
```

**Credentials Used:**
- `PATHAO_CLIENT_ID` and `PATHAO_CLIENT_SECRET` (required)
- `PATHAO_USERNAME` and `PATHAO_PASSWORD` (optional, for password grant)

#### `createPathaoOrder(order)`
Creates a shipping order on Pathao platform.

```typescript
const order: CommerceOrder = {
  id: "#10521",
  customer: "Maya Rahman",
  phone: "01711222333",
  address: "Banani, Dhaka",
  city: "Dhaka",
  total: 148,
  notes: "VIP customer",
  // ... other fields
};

const result = await createPathaoOrder(order);
// Returns: { consignmentId, orderStatus, deliveryFee }
```

**Payload Sent to Pathao:**
```typescript
{
  store_id: process.env.PATHAO_STORE_ID,
  merchant_order_id: order.wooId or order.id,
  sender_name: process.env.PATHAO_SENDER_NAME,
  sender_phone: process.env.PATHAO_SENDER_PHONE,
  recipient_name: order.customer,
  recipient_phone: order.phone,
  recipient_address: order.address,
  city_id: process.env.PATHAO_CITY_ID,
  zone_id: process.env.PATHAO_ZONE_ID,
  area_id: process.env.PATHAO_AREA_ID,
  special_instruction: order.notes,
  cash_receiver_amount: order.payable, // For COD
  parcel_weight: 1000, // Default 1kg
  parcel_category: "parcel",
  delivery_type: 48 // Standard delivery
}
```

#### `pathaoFetch(endpoint, options)`
Internal HTTP client with Bearer token auth.

```typescript
// Used internally, but can be called directly for custom requests
const data = await pathaoFetch('/merchant/orders/list', {
  method: 'GET',
});
```

### Required Environment Variables

```env
# OAuth Credentials
PATHAO_CLIENT_ID=your_client_id
PATHAO_CLIENT_SECRET=your_client_secret

# Optional: For password grant flow
PATHAO_USERNAME=your_username
PATHAO_PASSWORD=your_password

# Pathao Account Settings
PATHAO_STORE_ID=123
PATHAO_SENDER_NAME="Your Store"
PATHAO_SENDER_PHONE="01700000000"

# Location Configuration
PATHAO_CITY_ID=1        # 1=Dhaka
PATHAO_ZONE_ID=1        # Dhaka zones
PATHAO_AREA_ID=1        # Specific area

# API Configuration
PATHAO_BASE_URL=https://api-hermes.pathao.com  # Optional, has default
```

### Error Handling

```typescript
try {
  const result = await createPathaoOrder(order);
} catch (error) {
  if (error instanceof Error) {
    console.error('Pathao creation failed:', error.message);
    // Likely causes:
    // - Token expired or credentials invalid
    // - Store/Zone/Area IDs don't match account
    // - Phone number format invalid
    // - Address too long or has special chars
  }
}
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Token request failed | Invalid client credentials | Verify `PATHAO_CLIENT_ID` and `PATHAO_CLIENT_SECRET` in Pathao dashboard |
| 422 Validation Error | Invalid city/zone/area IDs | Fetch available locations from Pathao admin or contact support |
| Phone format error | Invalid phone number | Must be 11 digits, format: 01XXXXXXXXX |
| Address too long | Address field limit | Truncate to max 255 chars, remove special characters |
| Insufficient balance | Account has no credit | Top up Pathao account wallet |

### Testing Pathao Integration

```typescript
// Test token retrieval
const token = await getPathaoToken();
console.log('Token retrieved successfully:', token.substring(0, 20) + '...');

// Test order creation with mock data
const testOrder: CommerceOrder = {
  id: "#TEST-001",
  wooId: 9999,
  customer: "Test Customer",
  phone: "01700000000",
  address: "Test Address, Dhaka",
  city: "Dhaka",
  total: 500,
  notes: "Test order",
  // ... other required fields
};

try {
  const result = await createPathaoOrder(testOrder);
  console.log('Order created:', result);
} catch (error) {
  console.error('Test failed:', error.message);
}
```

---

## Environment Configuration

### Template: `.env.example`
```env
# WooCommerce
WOOCOMMERCE_URL=https://store.example.com
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...

# Pathao
PATHAO_BASE_URL=https://api-hermes.pathao.com
PATHAO_CLIENT_ID=your_id
PATHAO_CLIENT_SECRET=your_secret
PATHAO_USERNAME=optional_username
PATHAO_PASSWORD=optional_password
PATHAO_STORE_ID=123
PATHAO_SENDER_NAME=Your Store Name
PATHAO_SENDER_PHONE=01700000000
PATHAO_CITY_ID=1
PATHAO_ZONE_ID=1
PATHAO_AREA_ID=1
```

### Validation

The `env.ts` file exports validation arrays:

```typescript
// Check if all required vars are present
import { hasEnv, requiredWooEnv, requiredPathaoEnv } from '@/lib/integrations/env';

if (!hasEnv(requiredWooEnv)) {
  throw new Error('WooCommerce not configured');
}

if (!hasEnv(requiredPathaoEnv)) {
  throw new Error('Pathao not configured');
}
```

---

## API Response Formats

### WooCommerce Order Response
```typescript
{
  id: 10521,
  status: "processing",
  total: "148.00",
  payment_method: "bacs",
  customer_note: "VIP customer. Add thank-you card.",
  billing: {
    first_name: "Maya",
    last_name: "Rahman",
    phone: "01711222333",
    address_1: "Banani",
    city: "Dhaka"
  },
  line_items: [
    { name: "Linen Shirt" },
    { name: "Relaxed Pant" }
  ],
  meta_data: [
    { key: "pathao_consignment", value: "PTH-784201" }
  ]
}
```

### Pathao Order Response
```typescript
{
  consignment_id: "PTH-784201",
  merchant_order_id: "10521",
  order_status: "pending_pickup",
  delivery_fee: 35,
  data: {
    consignment_id: "PTH-784201",
    order_status: "pending_pickup",
    delivery_fee: 35
  }
}
```

### CommerceOrder Format
```typescript
{
  id: "#10521",
  wooId: 10521,
  source: "WooCommerce",
  customer: "Maya Rahman",
  phone: "01711222333",
  address: "Banani, Dhaka",
  items: "Linen Shirt, Relaxed Pant",
  payment: "Bank transfer",
  status: "paid",
  courier: "Pathao",
  pathaoStatus: "Ready",
  pathaoConsignment: "",
  payable: 0,
  total: 148,
  city: "Dhaka",
  margin: "61%",
  notes: "VIP customer. Add thank-you card."
}
```

---

## Debugging Tips

### Enable Verbose Logging
Add this to integration functions:

```typescript
console.log('Request:', endpoint, options);
const response = await fetch(...);
console.log('Response:', response.status, data);
return data;
```

### Test API Calls with Curl

**WooCommerce:**
```bash
curl -u "ck_key:cs_secret" \
  "https://store.com/wp-json/wc/v3/orders"
```

**Pathao Token:**
```bash
curl -X POST https://api-hermes.pathao.com/aladdin/api/v1/issue-token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"ID","client_secret":"SECRET","grant_type":"client_credentials"}'
```

### Browser DevTools
- Check Network tab to see API requests
- Check Console for error messages
- Check Application > Cookies for auth tokens (if stored)

---

## Performance Considerations

### Caching
- **WooCommerce**: Fetches are fresh each time (no caching)
- **Pathao Token**: Cached within single request, regenerated for each request
- **Consider**: Add Redis caching for token to reduce auth calls

### Rate Limiting
- **WooCommerce**: ~10 req/sec typical, check their docs
- **Pathao**: Likely 100+ req/min, but confirm with support
- **Implement**: Add request queuing and backoff on 429 responses

### Batch Operations
- **Pathao bulk create**: Group order creations to avoid rate limits
- **WooCommerce sync**: Use pagination (limit/page params)
- **Current implementation**: Does not batch, adds one at a time

---

## Future Enhancements

1. **Webhook Support**: Listen for WooCommerce events instead of polling
2. **Status Sync**: Periodically fetch Pathao status and update WooCommerce
3. **Refund Handling**: Integrate refund workflows
4. **Multi-Courier**: Add support for other delivery services
5. **Inventory Sync**: Auto-adjust stock when orders/returns processed
6. **Analytics**: Track API call latencies and error rates

