const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
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

// Since getPathaoPortalOrders uses modern imports, we can implement/mock the minimal part of it
// or run it directly using dynamic import since it is a TS file, or compile it, or run node --import tsx/esm.
// Let's implement a quick version of the fetch logic here to test the API directly using the same credentials!

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
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || "Pathao merchant portal login failed");
  }
  return data.access_token;
}

async function run() {
  try {
    const token = await getMerchantPortalToken();
    console.log('Pathao login success. Token obtained.');
    
    // Let's query from 2026-03-01 onwards
    const params = new URLSearchParams({ per_page: '100', page: '1' });
    params.set("from_date", '2026-03-01');
    
    const url = `https://merchant.pathao.com/api/v1/orders/all?${params}`;
    console.log('Fetching:', url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    
    console.log('Response status:', res.status);
    const json = await res.json();
    console.log('Response code:', json.code);
    console.log('Data summary:', json.data ? {
      total: json.data.total,
      last_page: json.data.last_page,
      current_page: json.data.current_page,
      rowsCount: json.data.data?.length
    } : 'No data field');
    
    if (json.data && json.data.data) {
      console.log('First 3 rows:', json.data.data.slice(0, 3));
    }
  } catch (err) {
    console.error('Error running Pathao check:', err);
  }
}

run();
