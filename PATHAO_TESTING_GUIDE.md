# Pathao Integration Testing Guide

## Test Environment Setup

### Prerequisites
- Valid Pathao credentials (client_id, client_secret)
- Store ID configured in Pathao account
- Test address with known city/zone/area IDs
- cURL or Postman for testing

### Environment Configuration for Testing

```bash
# .env.local (for testing)
PATHAO_BASE_URL=https://api-hermes.pathao.com
PATHAO_CLIENT_ID=your-test-client-id
PATHAO_CLIENT_SECRET=your-test-client-secret
PATHAO_STORE_ID=your-test-store-id
PATHAO_SENDER_NAME=Test Store
PATHAO_SENDER_PHONE=01700000000
PATHAO_CITY_ID=1
PATHAO_ZONE_ID=1
PATHAO_AREA_ID=1
PATHAO_DELIVERY_TYPE=48
PATHAO_ITEM_TYPE=2
PATHAO_ITEM_WEIGHT=1
```

---

## API Endpoint Testing

### 1. Test Cities Endpoint

#### cURL
```bash
curl -X GET http://localhost:3000/api/pathao/cities
```

#### Expected Response
```json
{
  "cities": [
    { "cityId": 1, "cityName": "Dhaka" },
    { "cityId": 2, "cityName": "Chittagong" }
  ]
}
```

#### Postman
- Method: GET
- URL: `http://localhost:3000/api/pathao/cities`
- Headers: None required

---

### 2. Test Zones Endpoint

#### cURL
```bash
curl -X GET "http://localhost:3000/api/pathao/zones?cityId=1"
```

#### Expected Response
```json
{
  "zones": [
    { "zoneId": 1, "zoneName": "Dhaka North" },
    { "zoneId": 2, "zoneName": "Dhaka South" }
  ]
}
```

#### Postman
- Method: GET
- URL: `http://localhost:3000/api/pathao/zones`
- Query Parameters: `cityId=1`

---

### 3. Test Areas Endpoint

#### cURL
```bash
curl -X GET "http://localhost:3000/api/pathao/areas?zoneId=1"
```

#### Expected Response
```json
{
  "areas": [
    { "areaId": 1, "areaName": "Banani" },
    { "areaId": 2, "areaName": "Baridhara" }
  ]
}
```

---

### 4. Test Account Info Endpoint

#### cURL
```bash
curl -X GET http://localhost:3000/api/pathao/account
```

#### Expected Response
```json
{
  "accountId": 12345,
  "accountName": "ThreadOps Store",
  "balance": 50000,
  "codBalance": 25000
}
```

---

### 5. Test Create Order Endpoint

#### cURL
```bash
curl -X POST http://localhost:3000/api/pathao/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "id": "TEST-001",
      "wooId": 1001,
      "customer": "Test Customer",
      "phone": "01700000000",
      "address": "123 Test Street, Banani, Dhaka",
      "items": ["Test Product"],
      "payable": 1000,
      "total": 1000,
      "notes": "Test order"
    }
  }'
```

#### Expected Response (201)
```json
{
  "pathao": {
    "consignmentId": "PATHAO-123456",
    "status": "Booked",
    "deliveryFee": 150
  }
}
```

#### Postman Setup
1. Method: POST
2. URL: `http://localhost:3000/api/pathao/orders`
3. Headers:
   - Content-Type: application/json
4. Body (raw JSON):
```json
{
  "order": {
    "id": "TEST-001",
    "wooId": 1001,
    "customer": "Test Customer",
    "phone": "01700000000",
    "address": "123 Test Street, Banani, Dhaka",
    "items": ["Test Product"],
    "payable": 1000,
    "total": 1000
  }
}
```

---

### 6. Test Get Consignments Endpoint

#### cURL
```bash
# Get all pending orders
curl -X GET "http://localhost:3000/api/pathao/orders?status=Pending&limit=10&page=1"
```

#### Expected Response
```json
{
  "consignments": [
    {
      "consignmentId": "PATHAO-123456",
      "merchantOrderId": "TEST-001",
      "status": "Pending",
      "deliveryFee": 150,
      "codAmount": 1000,
      "updatedAt": "2026-05-27T10:30:00Z"
    }
  ]
}
```

---

### 7. Test Get Consignment Status Endpoint

#### cURL
```bash
curl -X GET http://localhost:3000/api/pathao/orders/PATHAO-123456
```

#### Expected Response
```json
{
  "consignmentId": "PATHAO-123456",
  "status": "Pending",
  "deliveryFee": 150,
  "codAmount": 1000,
  "updatedAt": "2026-05-27T10:30:00Z"
}
```

---

### 8. Test Cancel Consignment Endpoint

#### cURL
```bash
curl -X DELETE http://localhost:3000/api/pathao/orders/PATHAO-123456
```

#### Expected Response
```json
{
  "consignmentId": "PATHAO-123456",
  "status": "Cancelled",
  "message": "Consignment cancelled successfully"
}
```

---

### 9. Test Bulk Create Orders Endpoint

#### cURL
```bash
curl -X POST http://localhost:3000/api/pathao/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      {
        "id": "TEST-002",
        "wooId": 1002,
        "customer": "Customer 1",
        "phone": "01700000001",
        "address": "Address 1",
        "items": ["Product 1"],
        "payable": 1000,
        "total": 1000
      },
      {
        "id": "TEST-003",
        "wooId": 1003,
        "customer": "Customer 2",
        "phone": "01700000002",
        "address": "Address 2",
        "items": ["Product 2"],
        "payable": 1500,
        "total": 1500
      }
    ]
  }'
```

#### Expected Response
```json
{
  "result": {
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "consignments": [
      {
        "orderId": "TEST-002",
        "status": "success",
        "consignmentId": "PATHAO-123457",
        "error": null
      },
      {
        "orderId": "TEST-003",
        "status": "success",
        "consignmentId": "PATHAO-123458",
        "error": null
      }
    ]
  }
}
```

---

## Integration Testing Scenarios

### Scenario 1: Complete Order Flow

1. **Create an order**
   ```bash
   curl -X POST http://localhost:3000/api/pathao/orders \
     -H "Content-Type: application/json" \
     -d '{"order": {...}}'
   ```
   - Save `consignmentId` from response

2. **Check order status**
   ```bash
   curl -X GET http://localhost:3000/api/pathao/orders/{consignmentId}
   ```
   - Verify status is "Booked" or "Pending"

3. **List all orders**
   ```bash
   curl -X GET "http://localhost:3000/api/pathao/orders?limit=50"
   ```
   - Verify created order appears in list

4. **Cancel order (if needed)**
   ```bash
   curl -X DELETE http://localhost:3000/api/pathao/orders/{consignmentId}
   ```
   - Verify status changes to "Cancelled"

---

### Scenario 2: Address Validation Flow

1. **Fetch cities**
   ```bash
   curl http://localhost:3000/api/pathao/cities
   ```

2. **Select city and fetch zones**
   ```bash
   curl "http://localhost:3000/api/pathao/zones?cityId=1"
   ```

3. **Select zone and fetch areas**
   ```bash
   curl "http://localhost:3000/api/pathao/areas?zoneId=1"
   ```

4. **Use validated IDs in order creation**
   ```bash
   curl -X POST http://localhost:3000/api/pathao/orders \
     -H "Content-Type: application/json" \
     -d '{
       "order": {
         "id": "ORDER-123",
         "customer": "Name",
         "phone": "01700000000",
         "address": "123 Main St",
         "items": ["Product"],
         "payable": 1000,
         "total": 1000
       }
     }'
   ```

---

## Error Scenarios

### Missing Environment Variables
**Request:** `curl http://localhost:3000/api/pathao/cities`  
**Response (400):**
```json
{
  "error": "Pathao credentials are not configured"
}
```
**Fix:** Configure all required ENV variables

---

### Invalid Order Data
**Request:** Create order without phone
```bash
curl -X POST http://localhost:3000/api/pathao/orders \
  -H "Content-Type: application/json" \
  -d '{"order": {"id": "TEST", "customer": "Name"}}'
```
**Response (400):**
```json
{
  "error": "Missing Pathao booking fields: phone, address, payable"
}
```
**Fix:** Include all required fields in order

---

### Invalid Location IDs
**Request:** Create order with invalid zone_id
**Response (400):**
```json
{
  "error": "Invalid zone_id"
}
```
**Fix:** Fetch valid zone IDs from `/api/pathao/zones`

---

### Insufficient Balance
**Request:** Create order when account balance is low
**Response (400):**
```json
{
  "error": "Insufficient balance for delivery fee"
}
```
**Fix:** Top up Pathao account

---

## Performance Testing

### Load Test: Create 100 Orders

```bash
#!/bin/bash
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/pathao/orders \
    -H "Content-Type: application/json" \
    -d "{
      \"order\": {
        \"id\": \"LOAD-$i\",
        \"wooId\": $i,
        \"customer\": \"Customer $i\",
        \"phone\": \"0170000$i\",
        \"address\": \"Address $i\",
        \"items\": [\"Product\"],
        \"payable\": 1000,
        \"total\": 1000
      }
    }" &
  
  # Limit concurrent requests
  if [ $((i % 10)) -eq 0 ]; then
    wait
  fi
done
wait
```

---

## Monitoring & Debugging

### Check Recent Consignments
```bash
curl -X GET "http://localhost:3000/api/pathao/orders?limit=5&page=1"
```

### Check Consignment Status Changes
Monitor status updates every 5 minutes:
```bash
while true; do
  curl http://localhost:3000/api/pathao/orders/PATHAO-123456
  sleep 300
done
```

### Check Account Balance
Monitor balance to detect payment issues:
```bash
curl http://localhost:3000/api/pathao/account
```

---

## Postman Collection

### Import JSON Collection

Create a file `pathao-collection.json`:

```json
{
  "info": {
    "name": "Pathao API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Cities",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/api/pathao/cities"
      }
    },
    {
      "name": "Create Order",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/api/pathao/orders",
        "body": {
          "mode": "raw",
          "raw": "{\"order\": {}}"
        }
      }
    }
  ]
}
```

Import into Postman: File → Import

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid credentials | Verify CLIENT_ID and CLIENT_SECRET |
| 404 Not Found | Invalid consignment ID | Use actual consignment ID from creation |
| 400 Bad Request | Missing fields | Check all required fields are present |
| Timeout | Pathao API unreachable | Check network, verify PATHAO_BASE_URL |
| Low balance error | Insufficient funds | Top up account at pathao.com |

---

**Last Updated:** May 27, 2026  
**Test Environment:** Development  
**Framework:** Next.js 16
