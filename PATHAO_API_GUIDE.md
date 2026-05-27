# Pathao Integration API Documentation

## Overview

Complete Pathao delivery service integration with OAuth 2.0 authentication, order management, and address lookup capabilities.

**Base URL:** `https://api-hermes.pathao.com/aladdin/api/v1`  
**Authentication:** Bearer Token (OAuth 2.0)

---

## Authentication

### Token Endpoint
- **URL:** `POST /issue-token`
- **Grant Types:** `client_credentials` or `password`

### Client Credentials Flow (Recommended)
```json
{
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "grant_type": "client_credentials"
}
```

### Password Flow
```json
{
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "grant_type": "password",
  "username": "your-username",
  "password": "your-password"
}
```

### Response
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLC...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Environment Variables Required
```env
PATHAO_BASE_URL=https://api-hermes.pathao.com
PATHAO_CLIENT_ID=your-client-id
PATHAO_CLIENT_SECRET=your-client-secret
PATHAO_STORE_ID=your-store-id
PATHAO_SENDER_NAME=Your Store Name
PATHAO_SENDER_PHONE=01700000000
PATHAO_CITY_ID=1
PATHAO_ZONE_ID=1
PATHAO_AREA_ID=1
PATHAO_DELIVERY_TYPE=48
PATHAO_ITEM_TYPE=2
PATHAO_ITEM_WEIGHT=1
```

---

## API Endpoints

### 1. Create Order

**POST** `/api/pathao/orders`

Creates a single or bulk Pathao delivery order.

#### Single Order Request
```json
{
  "order": {
    "id": "WOO-12345",
    "wooId": 12345,
    "customer": "Ayesha Khan",
    "phone": "01700000000",
    "address": "Banani, Dhaka",
    "items": ["Black Linen Shirt M"],
    "payable": 2450,
    "total": 2450,
    "notes": "Handle with care"
  }
}
```

#### Bulk Orders Request
```json
{
  "orders": [
    { /* order object 1 */ },
    { /* order object 2 */ }
  ]
}
```

#### Success Response (201)
```json
{
  "pathao": {
    "consignmentId": "PATHAO-123456",
    "status": "Booked",
    "deliveryFee": 150
  }
}
```

#### Error Response (400)
```json
{
  "error": "Missing Pathao booking fields: city_id, zone_id, area_id"
}
```

---

### 2. Get All Consignments

**GET** `/api/pathao/orders?status=Pending&limit=10&page=1`

Retrieve all consignments with optional filtering and pagination.

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (Pending, Delivered, Cancelled, etc.) |
| `limit` | number | Results per page (default: 100, max: 1000) |
| `page` | number | Page number (default: 1) |

#### Success Response (200)
```json
{
  "consignments": [
    {
      "consignmentId": "PATHAO-123456",
      "merchantOrderId": "WOO-12345",
      "status": "Pending",
      "deliveryFee": 150,
      "codAmount": 2450,
      "updatedAt": "2026-05-27T10:30:00Z"
    }
  ]
}
```

---

### 3. Get Consignment Status

**GET** `/api/pathao/orders/{consignmentId}`

Get detailed status of a specific consignment.

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `consignmentId` | string | Pathao consignment ID |

#### Success Response (200)
```json
{
  "consignmentId": "PATHAO-123456",
  "status": "Delivered",
  "deliveryFee": 150,
  "codAmount": 2450,
  "updatedAt": "2026-05-27T14:45:00Z"
}
```

#### Possible Status Values
- `Pending` - Order created, awaiting pickup
- `Picked` - Package picked up by courier
- `In Transit` - Package on delivery route
- `Delivered` - Successfully delivered
- `Cancelled` - Order cancelled
- `Failed` - Delivery attempt failed
- `Returned` - Package returned to sender

---

### 4. Cancel Consignment

**DELETE** `/api/pathao/orders/{consignmentId}`

Cancel an existing consignment (usually only possible if status is Pending or Picked).

#### Success Response (200)
```json
{
  "consignmentId": "PATHAO-123456",
  "status": "Cancelled",
  "message": "Consignment cancelled successfully"
}
```

---

### 5. Get Cities

**GET** `/api/pathao/cities`

Get list of all available cities for delivery.

#### Success Response (200)
```json
{
  "cities": [
    {
      "cityId": 1,
      "cityName": "Dhaka"
    },
    {
      "cityId": 2,
      "cityName": "Chittagong"
    }
  ]
}
```

---

### 6. Get Zones by City

**GET** `/api/pathao/zones?cityId=1`

Get zones within a specific city.

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cityId` | number | Yes | City ID from /cities endpoint |

#### Success Response (200)
```json
{
  "zones": [
    {
      "zoneId": 1,
      "zoneName": "Dhaka North"
    },
    {
      "zoneId": 2,
      "zoneName": "Dhaka South"
    }
  ]
}
```

---

### 7. Get Areas by Zone

**GET** `/api/pathao/areas?zoneId=1`

Get areas (neighborhoods) within a specific zone.

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zoneId` | number | Yes | Zone ID from /zones endpoint |

#### Success Response (200)
```json
{
  "areas": [
    {
      "areaId": 1,
      "areaName": "Banani"
    },
    {
      "areaId": 2,
      "areaName": "Baridhara"
    }
  ]
}
```

---

### 8. Get Account Information

**GET** `/api/pathao/account`

Get Pathao account details and current balance.

#### Success Response (200)
```json
{
  "accountId": 12345,
  "accountName": "ThreadOps Store",
  "balance": 50000,
  "codBalance": 25000
}
```

---

## Implementation Examples

### JavaScript/TypeScript

#### Create an Order
```typescript
const response = await fetch('/api/pathao/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    order: {
      id: 'WOO-12345',
      wooId: 12345,
      customer: 'Ayesha Khan',
      phone: '01700000000',
      address: 'Banani, Dhaka',
      items: ['Black Linen Shirt M'],
      payable: 2450,
      total: 2450,
      notes: 'Handle with care'
    }
  })
});

const data = await response.json();
console.log(data.pathao.consignmentId); // PATHAO-123456
```

#### Get Consignment Status
```typescript
const response = await fetch('/api/pathao/orders/PATHAO-123456');
const data = await response.json();
console.log(data.status); // Delivered
```

#### Get Cities for Address Form
```typescript
const response = await fetch('/api/pathao/cities');
const { cities } = await response.json();

// Get zones for selected city
const zonesResponse = await fetch(`/api/pathao/zones?cityId=${cities[0].cityId}`);
const { zones } = await zonesResponse.json();

// Get areas for selected zone
const areasResponse = await fetch(`/api/pathao/areas?zoneId=${zones[0].zoneId}`);
const { areas } = await areasResponse.json();
```

---

## Server-Side Usage

### Using TypeScript Functions Directly

```typescript
import {
  createPathaoOrder,
  getPathaoConsignmentStatus,
  getPathaoCities,
  getPathaoZones,
  getPathaoAreas,
  getPathaoAccountInfo,
  bulkCreatePathaoOrders
} from '@/lib/integrations/pathao';

// Create a single order
const result = await createPathaoOrder(commerceOrder);
console.log(result.consignmentId);

// Get cities
const cities = await getPathaoCities();

// Get zones for city
const zones = await getPathaoZones(1);

// Get areas for zone
const areas = await getPathaoAreas(1);

// Get account balance
const account = await getPathaoAccountInfo();

// Bulk create orders
const bulkResult = await bulkCreatePathaoOrders([order1, order2, order3]);
console.log(`${bulkResult.succeeded} succeeded, ${bulkResult.failed} failed`);
```

---

## Error Handling

All endpoints return error responses with a descriptive message:

```json
{
  "error": "Missing Pathao credentials are not configured"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing Pathao credentials` | ENV variables not set | Configure .env.local |
| `Missing required fields` | Required fields not provided | Check order object fields |
| `Invalid city/zone/area` | Location IDs don't exist | Fetch valid IDs from endpoints |
| `Insufficient balance` | Account balance too low | Topup Pathao account |
| `Cannot cancel order` | Order already shipped | Can only cancel Pending/Picked orders |

---

## Delivery Type Reference

Common delivery types used in order creation:

| Code | Type | Notes |
|------|------|-------|
| 48 | Cash on Delivery (COD) | Receiver pays upon delivery |
| 1 | Prepaid | Payment already received |

---

## Item Type Reference

Common item types:

| Code | Type |
|------|------|
| 1 | Document |
| 2 | Parcel |
| 3 | Fragile |

---

## Rate Limiting

- No explicit rate limits documented by Pathao
- Recommended: Max 100 requests per second
- Bulk operations: Process in batches of 50-100

---

## Testing

### Test Credentials
Contact Pathao support for sandbox credentials at `support@pathao.com`

### Test Order Flow
1. Create order with test credentials
2. Check status endpoint
3. Verify location hierarchy (cities → zones → areas)
4. Monitor account balance

---

## Support

- **Pathao Support:** support@pathao.com
- **Documentation:** https://pathao.com/api-documentation
- **Issue Tracker:** Check `GET /api/config/status` endpoint for connectivity

---

**Last Updated:** May 27, 2026  
**API Version:** v1  
**Client Version:** 1.0.0
