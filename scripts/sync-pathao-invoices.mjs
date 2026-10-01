// Snapshot Pathao payment invoices (with per-consignment breakdowns) into
// lib/data/pathao_invoices.json.
//
// Pathao purges orders older than a few months from its order APIs, but paid
// invoices stay available. Paid invoices never change, so they're stored once
// and re-runs only fetch new ones.
//
// Usage: node scripts/sync-pathao-invoices.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'lib/data/pathao_invoices.json');
const API = 'https://merchant.pathao.com/api/v1';

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, headers) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return res.json();
  }
  throw new Error(`${url} → rate limited`);
}

const login = await fetch(`${API}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ username: process.env.PATHAO_USERNAME, password: process.env.PATHAO_PASSWORD }),
}).then((r) => r.json());
if (!login.access_token) throw new Error(`Pathao login failed: ${login.message}`);
const headers = { Authorization: `Bearer ${login.access_token}`, Accept: 'application/json' };

const snapshot = fs.existsSync(OUT)
  ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
  : { synced_at: null, invoices: {}, orders: [] };

const invoices = [];
for (let page = 1; ; page++) {
  const json = await getJson(`${API}/monetary/invoices/list?page=${page}&limit=100`, headers);
  const rows = json.data?.data ?? [];
  invoices.push(...rows);
  if (rows.length === 0 || page >= (json.data?.last_page ?? 1)) break;
  await sleep(300);
}

const pending = invoices.filter((i) => i.payment_status === 'paid' && !snapshot.invoices[i.invoice_id]);
console.log(`${invoices.length} invoices on Pathao, ${pending.length} new paid invoices to fetch`);

for (const [n, inv] of pending.entries()) {
  const json = await getJson(`${API}/monetary/invoices/${inv.invoice_id}/breakdown`, headers);
  for (const d of json.data ?? []) {
    snapshot.orders.push({
      consignment_id: d.consignment_id,
      created_at: d.created_at,
      invoice_type: d.invoice_type,
      merchant_order_id: d.merchant_order_id === 'N/A' ? '' : String(d.merchant_order_id ?? ''),
      collectable_amount: d.collectable_amount,
      collected_amount: d.collected_amount,
      delivery_fee: d.delivery_fee,
      final_fee: d.final_fee,
      payout: d.payout,
      invoice_id: inv.invoice_id,
    });
  }
  snapshot.invoices[inv.invoice_id] = {
    created_at: inv.created_at,
    paid_at: inv.paid_at ?? null,
    payable_amount: inv.payable_amount,
  };
  if ((n + 1) % 25 === 0) console.log(`  ${n + 1}/${pending.length}`);
  await sleep(250);
}

snapshot.orders.sort((a, b) => a.created_at.localeCompare(b.created_at));
snapshot.synced_at = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(snapshot));
console.log(`Saved ${Object.keys(snapshot.invoices).length} invoices / ${snapshot.orders.length} consignments → ${path.relative(ROOT, OUT)}`);
