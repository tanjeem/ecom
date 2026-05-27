# Complete Pathao Integration - Production Guide

## Official Pathao API Information

**API Base URL:** `https://api-hermes.pathao.com/aladdin/api/v1`  
**Authentication:** Bearer Token (OAuth 2.0)  
**Client ID:** `KQe1rkoaJY`  
**API Documentation:** Official Pathao Courier Merchant API

---

## Table of Contents

1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Order Management](#order-management)
4. [Location Management](#location-management)
5. [Store Management](#store-management)
6. [Pricing](#pricing)
7. [Implementation Examples](#implementation-examples)
8. [Error Handling](#error-handling)

---

## Authentication

### Token Request

**Endpoint:** `POST /aladdin/api/v1/issue-token`

The system uses OAuth 2.0 password grant type for authentication.

#### Request
```bash
curl --location '{{base_url}}/aladdin/api/v1/issue-token' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "client_id": "KQe1rkoaJY",
    "client_secret": "{{client_secret}}",
    "grant_type": "password",
    "username": "tanjeem.adeeb@gmail.com",
    "password": "limitedshingara"
  }'
```

#### Response (200)
```json
{
  "token_type": "Bearer",
  "expires_in": 432000,
  "access_token": "eyJ0eXAiOiJKV1QiLC...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLC..."
}
```

### Environment Variables

```env
# Authentication
PATHAO_BASE_URL=https://api-hermes.pathao.com
PATHAO_CLIENT_ID=KQe1rkoaJY
PATHAO_CLIENT_SECRET=your-secret-here
PATHAO_USERNAME=tanjeem.adeeb@gmail.com
PATHAO_PASSWORD=limitedshingara

# Store Configuration
PATHAO_STORE_ID=your-store-id
PATHAO_DELIVERY_TYPE=48           # 48=Normal, 12=On Demand
PATHAO_ITEM_TYPE=2                # 1=Document, 2=Parcel, 3=Fragile
PATHAO_ITEM_WEIGHT=0.5            # Min 0.5kg, Max 10kg
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/issue-token` | Get access token |
| POST | `/issue-token` | Refresh token |

### Orders

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/orders` | Create single order |
| POST | `/orders/bulk` | Create multiple orders |
| GET | `/orders/{id}/info` | Get order short info |
| GET | `/orders/{id}` | Get order details |
| DELETE | `/orders/{id}` | Cancel order |

### Location Data

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/city-list` | Get all cities |
| GET | `/cities/{id}/zone-list` | Get zones in city |
| GET | `/zones/{id}/area-list` | Get areas in zone |

### Stores

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/stores` | Get merchant stores |
| POST | `/stores` | Create new store |

### Pricing

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/merchant/price-plan` | Calculate delivery fee |

---

## Order Management

### 1. Create Single Order

**POST** `/api/pathao/orders`

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
      address: 'House 123, Road 4, Sector 10, Uttara, Dhaka-1230, Bangladesh',
      items: ['Black Linen Shirt M'],
      payable: 2450,
      total: 2450,
      notes: 'Handle with care'
    }
  })
});

const { pathao } = await response.json();
// {
//   consignmentId: "PATHAO-123456",
//   status: "Pending",
//   deliveryFee: 80
// }
```

### 2. Create Bulk Orders

**POST** `/api/pathao/bulk`

```typescript
const response = await fetch('/api/pathao/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orders: [
      { /* order 1 */ },
      { /* order 2 */ },
      { /* order 3 */ }
    ]
  })
});

const { result } = await response.json();
// {
//   accepted: true,
//   message: "Your bulk order creation request is accepted..."
// }
```

**Note:** Bulk orders are accepted asynchronously. Status code is 202.

### 3. Get Order Info

**GET** `/api/pathao/info/{consignmentId}`

```typescript
const response = await fetch('/api/pathao/info/PATHAO-123456');
const { status, updatedAt } = await response.json();
```

### 4. Get Order Status

**GET** `/api/pathao/orders/{consignmentId}`

```typescript
const response = await fetch('/api/pathao/orders/PATHAO-123456');
const { status, deliveryFee } = await response.json();
```

### 5. Cancel Order

**DELETE** `/api/pathao/orders/{consignmentId}`

```typescript
const response = await fetch('/api/pathao/orders/PATHAO-123456', {
  method: 'DELETE'
});
const { status } = await response.json();
// Only works if order status is Pending or Picked
```

---

## Location Management

### Get All Cities

**GET** `/api/pathao/cities`

```typescript
const response = await fetch('/api/pathao/cities');
const { cities } = await response.json();
// [
//   { cityId: 1, cityName: "Dhaka" },
//   { cityId: 2, cityName: "Chittagong" }
// ]
```

### Get Zones in City

**GET** `/api/pathao/zones?cityId=1`

```typescript
const response = await fetch('/api/pathao/zones?cityId=1');
const { zones } = await response.json();
// [
//   { zoneId: 298, zoneName: "60 feet" },
//   { zoneId: 1070, zoneName: "Abdullahpur Uttara" }
// ]
```

### Get Areas in Zone

**GET** `/api/pathao/areas?zoneId=298`

```typescript
const response = await fetch('/api/pathao/areas?zoneId=298');
const { areas } = await response.json();
// [
//   {
//     areaId: 37,
//     areaName: "Bonolota",
//     homeDeliveryAvailable: true,
//     pickupAvailable: true
//   }
// ]
```

---

## Store Management

### Get Merchant Stores

**GET** `/api/pathao/stores`

```typescript
const response = await fetch('/api/pathao/stores');
const { stores, total } = await response.json();
// {
//   stores: [
//     {
//       storeId: 123,
//       storeName: "ThreadOps Store",
//       storeAddress: "Address...",
//       isActive: true,
//       cityId: 1,
//       zoneId: 298,
//       ...
//     }
//   ],
//   total: 1
// }
```

---

## Pricing

### Calculate Delivery Price

**POST** `/api/pathao/price`

Calculate delivery fee before booking order.

```typescript
const response = await fetch('/api/pathao/price', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    storeId: 123,
    itemType: 2,              // 2 = Parcel
    deliveryType: 48,         // 48 = Normal, 12 = On Demand
    itemWeight: 0.5,          // kg
    recipientCity: 1,         // Dhaka
    recipientZone: 298        // 60 feet
  })
});

const { finalPrice, codEnabled, codPercentage } = await response.json();
// {
//   price: 80,
//   discount: 0,
//   promoDiscount: 0,
//   codEnabled: true,
//   codPercentage: 0.01,
//   finalPrice: 80
// }
```

---

## Order Statuses

### Status Flow

```
Pending → Picked → In Transit → Delivered
   ↓
 Failed (retry possible)
   ↓
Returned
```

### All Possible Statuses

| Status | Meaning |
|--------|---------|
| Pending | Order created, awaiting pickup |
| Picked | Package picked up from store |
| In Transit | On delivery route |
| Delivered | Successfully delivered |
| Failed | Delivery attempt failed |
| Returned | Returned to sender |
| Cancelled | Order cancelled |

---

## Implementation Examples

### Complete Order Creation Flow

```typescript
// 1. Get cities
const citiesRes = await fetch('/api/pathao/cities');
const { cities } = await citiesRes.json();

// 2. Get zones for city
const zonesRes = await fetch(`/api/pathao/zones?cityId=${cities[0].cityId}`);
const { zones } = await zonesRes.json();

// 3. Get areas for zone
const areasRes = await fetch(`/api/pathao/areas?zoneId=${zones[0].zoneId}`);
const { areas } = await areasRes.json();

// 4. Calculate price
const priceRes = await fetch('/api/pathao/price', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    storeId: 123,
    itemWeight: 0.5,
    recipientCity: cities[0].cityId,
    recipientZone: zones[0].zoneId
  })
});
const pricing = await priceRes.json();

// 5. Create order
const orderRes = await fetch('/api/pathao/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    order: {
      id: 'WOO-001',
      customer: 'Customer Name',
      phone: '01700000000',
      address: 'Full address in selected area',
      items: ['Product Name'],
      payable: 2450,
      total: 2450
    }
  })
});
const { pathao } = await orderRes.json();
console.log(`Order created: ${pathao.consignmentId}`);
```

### Bulk Order Creation

```typescript
const orders = [
  {
    id: 'WOO-001',
    customer: 'Customer 1',
    phone: '01700000001',
    address: 'Address 1',
    items: ['Product'],
    payable: 1000,
    total: 1000
  },
  {
    id: 'WOO-002',
    customer: 'Customer 2',
    phone: '01700000002',
    address: 'Address 2',
    items: ['Product'],
    payable: 1500,
    total: 1500
  }
];

const response = await fetch('/api/pathao/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orders })
});

const { result } = await response.json();
console.log(`${result.total} orders submitted for processing`);
```

### Track Order Status

```typescript
async function trackOrder(consignmentId) {
  const infoRes = await fetch(`/api/pathao/info/${consignmentId}`);
  const info = await infoRes.json();
  
  console.log(`Status: ${info.status}`);
  console.log(`Last updated: ${info.updatedAt}`);
  
  if (info.invoiceId) {
    console.log(`Invoice: ${info.invoiceId}`);
  }
  
  return info;
}
```

---

## Error Handling

### Common Errors

```json
{
  "error": "Pathao credentials are not configured"
}
```

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid credentials | Wrong client_id/secret | Verify credentials |
| Order not found | Wrong consignment_id | Check consignment ID |
| Cannot cancel | Order already shipped | Only cancel Pending/Picked orders |
| Insufficient balance | No delivery balance | Top up account |
| Invalid address | Address not in service area | Use valid city/zone/area |

### Error Response Format

```json
{
  "error": "Missing required fields: phone, address"
}
```

All errors return appropriate HTTP status codes:
- 200: Success
- 201: Created
- 202: Accepted (bulk orders)
- 400: Bad request
- 401: Unauthorized
- 404: Not found
- 500: Server error

---

## Testing Credentials

```env
# For Testing
PATHAO_CLIENT_ID=KQe1rkoaJY
PATHAO_USERNAME=tanjeem.adeeb@gmail.com
PATHAO_PASSWORD=limitedshingara
```

**Note:** Contact Pathao support for production credentials and stores.

---

## Rate Limits

- No explicit rate limits documented
- Recommended: Max 100 requests/second
- Bulk operations: Optimal batch size 50-100 orders

---

## Server-Side TypeScript Functions

```typescript
import {
  createPathaoOrder,
  bulkCreatePathaoOrders,
  getPathaoConsignmentInfo,
  getPathaoStores,
  getPathaoCities,
  getPathaoZones,
  getPathaoAreas,
  calculatePathaoPrice
} from '@/lib/integrations/pathao';

// Create order
const result = await createPathaoOrder(commerceOrder);

// Get cities
const { cities } = await getPathaoCities();

// Calculate price
const pricing = await calculatePathaoPrice({
  storeId: 123,
  itemType: 2,
  deliveryType: 48,
  itemWeight: 0.5,
  recipientCity: 1,
  recipientZone: 298
});
```

---

## Deployment Checklist

- [ ] Pathao credentials obtained and tested
- [ ] All ENV variables configured in production
- [ ] Store ID configured
- [ ] API routes deployed
- [ ] Error handling tested
- [ ] Bulk operations tested
- [ ] Account balance monitored
- [ ] Webhook handlers ready (if using)

---

## Support

- **Pathao Support:** support@pathao.com
- **Merchant Dashboard:** https://merchant.pathao.com
- **API Docs:** Contact Pathao for official documentation

---

**Last Updated:** May 27, 2026  
**Implementation Status:** ✅ Complete  
**API Version:** v1 (Aladdin API)  
**Framework:** Next.js 16 + TypeScript
