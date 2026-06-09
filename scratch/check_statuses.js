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

function parseCSVLine(line) {
  const result = [];
  let inQuotes = false;
  let current = '';
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

async function run() {
  // Check CSV statuses
  const csvStatuses = new Set();
  const csvPath = path.join(__dirname, '../lib/data/archived_orders.csv');
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    if (lines.length > 1) {
      const headers = parseCSVLine(lines[0]);
      const statusIdx = headers.indexOf('Order status');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const row = parseCSVLine(line);
        if (row[statusIdx]) csvStatuses.add(row[statusIdx]);
      }
    }
  }
  console.log('Unique statuses in CSV:', Array.from(csvStatuses));

  // Check live API statuses
  const liveStatuses = new Set();
  try {
    const token = await getMerchantPortalToken();
    let page = 1;
    while (page <= 3) { // just check first 3 pages
      const params = new URLSearchParams({ per_page: '100', page: String(page), from_date: '2026-03-01' });
      const res = await fetch(`https://merchant.pathao.com/api/v1/orders/all?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
      });
      const json = await res.json();
      const rows = json.data?.data ?? [];
      for (const r of rows) {
        if (r.order_status) liveStatuses.add(r.order_status);
      }
      if (page >= (json.data?.last_page ?? 1) || rows.length === 0) break;
      page++;
    }
  } catch (e) {
    console.error('API Error:', e);
  }
  console.log('Unique statuses in live API (first 3 pages):', Array.from(liveStatuses));
}

run();
