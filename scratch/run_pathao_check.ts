import { getPathaoPortalOrders } from '../lib/integrations/pathao';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env.local manually
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

async function run() {
  try {
    console.log('Running getPathaoPortalOrders...');
    const orders = await getPathaoPortalOrders();
    console.log('Total orders returned:', orders.length);

    const monthlyCounts: Record<string, { total: number; delivered: number; returned: number; amount: number }> = {};
    const DELIVERED = new Set(['Delivered', 'Partial Delivery']);
    const RETURNED  = new Set(['Return', 'Returned to Merchant', 'Returned To Merchant', 'Return In Transit', 'Paid Return']);

    for (const order of orders) {
      const month = order.order_created_at?.slice(0, 7);
      if (!month) continue;
      if (!monthlyCounts[month]) {
        monthlyCounts[month] = { total: 0, delivered: 0, returned: 0, amount: 0 };
      }
      monthlyCounts[month].total++;
      if (DELIVERED.has(order.order_status)) {
        monthlyCounts[month].delivered++;
        monthlyCounts[month].amount += order.order_amount;
      } else if (RETURNED.has(order.order_status)) {
        monthlyCounts[month].returned++;
      }
    }

    console.log('Monthly summary of Pathao orders:');
    console.log(JSON.stringify(monthlyCounts, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
