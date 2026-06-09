const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      process.env[key] = value;
    }
  });
}

// Minimal implementation of fetchMetaMonthlyInsights
async function fetchMetaMonthlyInsights() {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;
  const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const time_range = JSON.stringify({ since: '2025-01-01', until: new Date().toISOString().slice(0, 10) });

  const query = new URLSearchParams({
    level: 'account',
    fields: 'spend,impressions,clicks,purchase_roas,actions,action_values,date_start,date_stop',
    time_range,
    time_increment: 'monthly',
    access_token: accessToken,
    limit: '100',
  });

  const url = `https://graph.facebook.com/v19.0/${formattedId}/insights?${query.toString()}`;
  const res = await fetch(url);
  const json = await res.json();
  const data = json.data || [];

  return data.map((item) => {
    const month = item.date_start.slice(0, 7); // YYYY-MM
    return {
      month,
      spend: parseFloat(item.spend || '0'),
      revenue: 0,
      roas: 0,
      cpa: 0,
      purchases: 0,
      impressions: parseInt(item.impressions || '0'),
      clicks: parseInt(item.clicks || '0'),
    };
  });
}

async function getMerchantPortalToken() {
  const res = await fetch("https://merchant.pathao.com/api/v1/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: process.env.PATHAO_USERNAME,
      password: process.env.PATHAO_PASSWORD,
    }),
  });
  const data = await res.json();
  return data.access_token;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function loadArchivedOrders() {
  const filePath = path.join(__dirname, '../lib/data/archived_orders.csv');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  if (lines.length <= 1) return [];
  
  const headers = parseCSVLine(lines[0]);
  const consignmentIdIdx = headers.indexOf('Order consignment id');
  const createdAtIdx = headers.indexOf('Order created at');
  const statusIdx = headers.indexOf('Order status');
  const collectedIdx = headers.indexOf('Collected amount');
  const collectableIdx = headers.indexOf('Collectable Amount');

  const orders = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const row = parseCSVLine(line);
    const status = row[statusIdx] || '';
    const collectedAmt = parseFloat(row[collectedIdx] || '0');
    const collectableAmt = parseFloat(row[collectableIdx] || '0');
    const amount = status.startsWith('Delivered') || status === 'Partial Delivery'
      ? (collectedAmt || collectableAmt)
      : collectableAmt;
    orders.push({
      order_consignment_id: row[consignmentIdIdx] || '',
      order_created_at: row[createdAtIdx] || '',
      order_amount: amount,
      order_status: status,
    });
  }
  return orders;
}

async function getPathaoPortalOrders() {
  const archivedOrders = loadArchivedOrders();
  const liveOrders = [];
  try {
    const token = await getMerchantPortalToken();
    let page = 1;
    while (true) {
      const params = new URLSearchParams({ per_page: '100', page: String(page), from_date: '2026-03-01' });
      const res = await fetch(`https://merchant.pathao.com/api/v1/orders/all?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
      });
      const json = await res.json();
      const rows = json.data?.data ?? [];
      liveOrders.push(...rows);
      if (page >= (json.data?.last_page ?? 1) || rows.length === 0) break;
      page++;
    }
  } catch (e) {
    console.error('API Error:', e);
  }

  const combinedMap = new Map();
  for (const o of archivedOrders) {
    if (o.order_consignment_id) combinedMap.set(o.order_consignment_id, o);
  }
  for (const o of liveOrders) {
    if (o.order_consignment_id) combinedMap.set(o.order_consignment_id, o);
  }
  return Array.from(combinedMap.values());
}

async function run() {
  try {
    const metaData = await fetchMetaMonthlyInsights();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Fetch Supabase store revenue transactions
    const txUrl = `${supabaseUrl}/rest/v1/fin_transactions?type=eq.income`;
    const txRes = await fetch(txUrl, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const transactions = await txRes.json();

    const storeRevenueBuckets = {};
    if (transactions) {
      for (const tx of transactions) {
        const month = tx.date?.slice(0, 7); // YYYY-MM
        if (!month) continue;
        if (tx.category === 'sales_prepaid' || tx.category === 'sales_cod') {
          if (!storeRevenueBuckets[month]) {
            storeRevenueBuckets[month] = 0;
          }
          storeRevenueBuckets[month] += Number(tx.amount) || 0;
        }
      }
    }

    const pathaoOrders = await getPathaoPortalOrders();
    console.log('Total pathao orders fetched:', pathaoOrders.length);

    const DELIVERED = new Set(['Delivered', 'Partial Delivery']);
    const RETURNED  = new Set(['Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit', 'Paid Return']);

    const pathaoBuckets = {};
    for (const order of pathaoOrders) {
      const month = order.order_created_at?.slice(0, 7);
      if (!month) continue;
      if (!pathaoBuckets[month]) {
        pathaoBuckets[month] = { deliveredCount: 0, returnedCount: 0, deliveredAmount: 0 };
      }
      const amount = order.order_amount || 0;
      if (DELIVERED.has(order.order_status)) {
        pathaoBuckets[month].deliveredCount++;
        pathaoBuckets[month].deliveredAmount += amount;
      } else if (RETURNED.has(order.order_status)) {
        pathaoBuckets[month].returnedCount++;
      }
    }

    console.log('Pathao buckets:', pathaoBuckets);

    const reconciledData = metaData.map((item) => {
      const month = item.month;
      const pathao = pathaoBuckets[month] || { deliveredCount: 0, returnedCount: 0, deliveredAmount: 0 };
      const storeRevenue = storeRevenueBuckets[month] || 0;

      return {
        month,
        spend: item.spend,
        storeRevenue,
        deliveredOrders: pathao.deliveredCount,
        returnedOrders: pathao.returnedCount,
        deliveredAmount: pathao.deliveredAmount,
      };
    });

    console.log('Reconciled data:', reconciledData);
  } catch (err) {
    console.error(err);
  }
}

run();
