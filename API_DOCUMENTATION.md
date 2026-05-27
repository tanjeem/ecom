# API Documentation

## Base URL

**Development:** `http://localhost:3000`  
**Production:** `https://yourdomain.com`

## Authentication

All endpoints are server-side and do not require client authentication. Authentication with WooCommerce and Pathao is handled server-side using environment variables.

---

## Endpoints

### 1. Config Status

Check if integrations are properly configured and accessible.

**Endpoint:** `GET /api/config/status`

**Query Parameters:** None

**Request Example:**
```bash
curl http://localhost:3000/api/config/status
```

**Response (200 OK):**
```json
{
  "woocommerce": true,
  "pathao": true,
  "pathaoBookingDefaults": true
}
```

**Response (200 OK, Partial Config):**
```json
{
  "woocommerce": false,
  "pathao": true,
  "pathaoBookingDefaults": false
}
```

**Response (400 Bad Request):**
```json
{
  "error": "WooCommerce credentials are not configured"
}
```

**Status Meanings:**
- `woocommerce: true` - WooCommerce URL and credentials are valid
- `pathao: true` - Pathao credentials are valid and token can be obtained
- `pathaoBookingDefaults: true` - Store/Zone/Area IDs are configured

**Use Cases:**
- Health check for monitoring
- Display configuration warnings to user
- Conditional UI (hide Pathao button if `pathao: false`)

---

### 2. Get Orders

Fetch orders from WooCommerce and format them for the dashboard.

**Endpoint:** `GET /api/orders`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | WooCommerce order status (processing, completed, on-hold, cancelled, etc.) |
| `limit` | number | No | 10 | Number of orders to fetch per page |
| `page` | number | No | 1 | Page number for pagination |
| `search` | string | No | - | Search by order ID or customer name (if supported by WooCommerce) |

**Request Examples:**

```bash
# Get all orders (default pagination)
curl "http://localhost:3000/api/orders"

# Get paid orders
curl "http://localhost:3000/api/orders?status=completed"

# Get on-hold orders
curl "http://localhost:3000/api/orders?status=on-hold"

# Pagination
curl "http://localhost:3000/api/orders?limit=50&page=2"

# Combine filters
curl "http://localhost:3000/api/orders?status=processing&limit=20&page=1"
```

**Response (200 OK):**
```json
{
  "orders": [
    {
      "id": "#10521",
      "wooId": 10521,
      "source": "WooCommerce",
      "customer": "Maya Rahman",
      "phone": "01711222333",
      "address": "Banani, Dhaka",
      "items": "Linen Shirt, Relaxed Pant",
      "payment": "Card paid",
      "status": "paid",
      "courier": "Pathao",
      "pathaoStatus": "Ready",
      "pathaoConsignment": "",
      "payable": 0,
      "total": 148,
      "city": "Dhaka",
      "margin": "61%",
      "notes": "VIP customer. Add thank-you card."
    },
    {
      "id": "#10520",
      "wooId": 10520,
      "source": "WooCommerce",
      "customer": "Jordan Lee",
      "phone": "01811444555",
      "address": "GEC Circle, Chattogram",
      "items": "Oversized Tee x2",
      "payment": "COD",
      "status": "packed",
      "courier": "Pathao",
      "pathaoStatus": "Booked",
      "pathaoConsignment": "PTH-784201",
      "payable": 84,
      "total": 84,
      "city": "Chattogram",
      "margin": "54%",
      "notes": "Ready for evening pickup."
    }
  ]
}
```

**Response (400 Bad Request):**
```json
{
  "error": "WooCommerce credentials are not configured"
}
```

**Response (503 Service Unavailable):**
```json
{
  "error": "Unable to sync WooCommerce orders"
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | ThreadOps order ID (e.g., #10521) |
| `wooId` | number | WooCommerce order ID |
| `source` | string | "WooCommerce" or "Inbox -> Woo" |
| `customer` | string | Customer full name |
| `phone` | string | 11-digit phone number |
| `address` | string | Delivery address |
| `items` | string | Comma-separated product names |
| `payment` | string | Payment method (Card paid, COD, Bkash pending, etc.) |
| `status` | string | "paid", "packed", "hold", "returned" |
| `courier` | string | Courier service name |
| `pathaoStatus` | string | Status on Pathao (Ready, Booked, Returned, etc.) |
| `pathaoConsignment` | string | Pathao tracking number (empty if not booked) |
| `payable` | number | COD amount to collect |
| `total` | number | Order total in currency |
| `city` | string | Delivery city |
| `margin` | string | Gross margin percentage (e.g., "61%") |
| `notes` | string | Order notes or special instructions |

---

### 3. Create Inbox Order

Create a new order in WooCommerce from manual/inbox entry.

**Endpoint:** `POST /api/orders/inbox`

**Request Body:**
```typescript
{
  "name": string;              // Required: Customer full name
  "phone": string;             // Required: 11-digit phone number
  "address": string;           // Required: Delivery address
  "product": string;           // Required: Product name or SKU
  "price": number;             // Required: Product price
  "productId"?: number;        // Optional: WooCommerce product ID
  "variationId"?: number;      // Optional: Product variation ID
  "quantity"?: number;         // Optional: Quantity (default 1)
  "city"?: string;             // Optional: Delivery city
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/orders/inbox \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ayesha Khan",
    "phone": "01700000000",
    "address": "Banani, Dhaka",
    "product": "Black Linen Shirt M",
    "price": 2450,
    "quantity": 1,
    "city": "Dhaka"
  }'
```

**Response (200 OK):**
```json
{
  "order": {
    "id": "#10522",
    "wooId": 10522,
    "source": "Inbox -> Woo",
    "customer": "Ayesha Khan",
    "phone": "01700000000",
    "address": "Banani, Dhaka",
    "items": "Black Linen Shirt M",
    "payment": "Pending",
    "status": "hold",
    "courier": "Unassigned",
    "pathaoStatus": "Hold",
    "pathaoConsignment": "",
    "payable": 0,
    "total": 2450,
    "city": "Dhaka",
    "margin": "0%",
    "notes": ""
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Product not found: Black Linen Shirt M"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid phone number format"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "WooCommerce credentials are not configured"
}
```

**Validation Rules:**
- `name`: Required, min 2 characters
- `phone`: Required, 11 digits starting with 01, regex: `^01\d{9}$`
- `address`: Required, min 5 characters
- `product`: Required, must match WooCommerce product (by name or SKU)
- `price`: Required, must be > 0
- `quantity`: Optional, default 1, must be > 0

**Use Cases:**
- Manual order entry from phone calls
- Order creation from messaging platforms
- CSV import (iterate and call multiple times)

---

### 4. Create Pathao Orders (Bulk)

Send selected orders to Pathao delivery service.

**Endpoint:** `POST /api/pathao/orders`

**Request Body:**
```typescript
{
  "orderIds": string[];  // Array of ThreadOps order IDs (e.g., ["#10521", "#10520"])
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/pathao/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderIds": ["#10521", "#10520"]
  }'
```

**Response (200 OK):**
```json
{
  "consignments": [
    {
      "orderId": "#10521",
      "consignmentId": "PTH-784201",
      "status": "pending_pickup",
      "deliveryFee": 35,
      "error": null
    },
    {
      "orderId": "#10520",
      "consignmentId": "PTH-784202",
      "status": "pending_pickup",
      "deliveryFee": 35,
      "error": null
    }
  ]
}
```

**Response (200 OK, Partial Failure):**
```json
{
  "consignments": [
    {
      "orderId": "#10521",
      "consignmentId": "PTH-784201",
      "status": "pending_pickup",
      "deliveryFee": 35,
      "error": null
    },
    {
      "orderId": "#10520",
      "consignmentId": null,
      "status": null,
      "deliveryFee": null,
      "error": "Invalid phone number format"
    }
  ]
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Pathao credentials are not configured"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "orderIds must be a non-empty array"
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `consignmentId` | string | Pathao tracking ID (null if failed) |
| `status` | string | Pathao order status (pending_pickup, in_transit, etc.) |
| `deliveryFee` | number | Delivery charge as per Pathao rates |
| `error` | string | Error message if creation failed, null if success |

**Use Cases:**
- Bulk dispatch of packed orders
- Send multiple orders in one request
- Scheduled batch sends (e.g., once per hour)

**Limits:**
- Recommended: ≤100 orders per request (to avoid timeout)
- For larger batches, split into multiple requests

---

### 5. Get Pathao Order Status

Get delivery status for a specific Pathao consignment.

**Endpoint:** `GET /api/pathao/orders/[consignmentId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `consignmentId` | string | Yes | Pathao consignment ID (e.g., PTH-784201) |

**Request Example:**
```bash
curl http://localhost:3000/api/pathao/orders/PTH-784201
```

**Response (200 OK):**
```json
{
  "consignmentId": "PTH-784201",
  "status": "in_transit",
  "updatedAt": "2026-05-27T10:30:00Z",
  "deliveryFee": 35,
  "attempts": 1,
  "merchantOrderId": "#10521"
}
```

**Response (200 OK, Delivered):**
```json
{
  "consignmentId": "PTH-784201",
  "status": "delivered",
  "updatedAt": "2026-05-27T14:15:00Z",
  "deliveryFee": 35,
  "deliveredAt": "2026-05-27T14:15:00Z",
  "merchantOrderId": "#10521"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Consignment not found"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Pathao credentials are not configured"
}
```

**Status Values:**
- `pending_pickup` - Waiting for Pathao rider pickup
- `in_transit` - In delivery
- `delivered` - Successfully delivered
- `returned` - Returned to sender
- `delivery_failed` - Delivery attempt failed
- `cancelled` - Order cancelled

**Use Cases:**
- Check single order status
- Update order status periodically
- Track delivery progress

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid input, missing required fields, service configuration error |
| 404 | Not Found | Resource not found (e.g., order, consignment) |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | WooCommerce or Pathao service is down |

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "WooCommerce credentials are not configured" | Missing env vars | Add to .env.local, restart server |
| "Pathao credentials are not configured" | Missing env vars | Add to .env.local, restart server |
| "Invalid phone number format" | Phone not 11 digits starting with 01 | Validate before sending |
| "Product not found: X" | Product doesn't exist in WooCommerce | Check product name/SKU in WooCommerce |
| "Insufficient balance" | Pathao account out of credit | Top up Pathao wallet |
| "Unable to sync WooCommerce orders" | WooCommerce API error | Check if store is online, credentials valid |

---

## Rate Limiting

Currently no rate limiting is implemented. For production, add middleware:

```typescript
// app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const requests = new Map<string, number[]>();
const LIMIT = 100; // requests
const WINDOW = 60000; // 1 minute

export function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown';
  const now = Date.now();
  const requestTimes = requests.get(ip) || [];
  
  // Remove old requests outside the window
  const recent = requestTimes.filter(time => now - time < WINDOW);
  
  if (recent.length >= LIMIT) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  
  recent.push(now);
  requests.set(ip, recent);
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*'
};
```

---

## Testing Endpoints

### Using cURL

```bash
# Get orders
curl http://localhost:3000/api/orders

# Get orders with filter
curl "http://localhost:3000/api/orders?status=completed&limit=5"

# Create inbox order
curl -X POST http://localhost:3000/api/orders/inbox \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"01700000000","address":"Dhaka","product":"Shirt","price":500}'

# Create Pathao orders
curl -X POST http://localhost:3000/api/pathao/orders \
  -H "Content-Type: application/json" \
  -d '{"orderIds":["#10521"]}'

# Get Pathao status
curl http://localhost:3000/api/pathao/orders/PTH-784201

# Check config
curl http://localhost:3000/api/config/status
```

### Using Postman

1. Import this as raw text into Postman:

```json
{
  "info": {
    "name": "ThreadOps Commerce API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Config Status",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/config/status"
      }
    },
    {
      "name": "Get Orders",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/orders?status=completed&limit=10"
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    }
  ]
}
```

2. Set `base_url` variable to your API URL
3. Run requests individually or in collection

---

## Response Time Expectations

- **Get Orders**: 500ms - 2s (depends on WooCommerce store size)
- **Create Inbox Order**: 1s - 3s (WooCommerce creation + response time)
- **Create Pathao Orders**: 500ms - 2s per order (token + creation)
- **Get Pathao Status**: 200ms - 1s (token cached if recent)
- **Config Status**: 1s - 5s (credential validation check)

For optimized performance, implement caching and consider Redis for token caching.

