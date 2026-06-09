import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://vhvioxzmanwbcuxzcuga.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodmlveHptYW53YmN1eHpjdWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTY2MjQsImV4cCI6MjA5NjQ5MjYyNH0.NAyc8GADmCY3vk2e4JL-eN6TgTF_9_kNfm8CawluuJo';

// We can read Meta credentials to try to fetch real Meta USD spends, or fall back to mock
let metaAccountId = '';
let metaToken = '';

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      if (key === 'META_AD_ACCOUNT_ID') metaAccountId = value;
      if (key === 'META_ADS_ACCESS_TOKEN') metaToken = value;
    }
  });
}

async function getMetaUSDSpends() {
  const spends = {};
  // Default values based on real data or mock ranges
  for (let m = 1; m <= 12; m++) {
    const monthKey = `2025-${String(m).padStart(2, '0')}`;
    spends[monthKey] = 400 + (m % 3) * 150 + Math.sin(m) * 80; // USD
  }

  if (metaAccountId && metaToken) {
    try {
      const formattedId = metaAccountId.startsWith('act_') ? metaAccountId : `act_${metaAccountId}`;
      const time_range = JSON.stringify({ since: '2025-01-01', until: '2025-12-31' });
      const query = new URLSearchParams({
        level: 'account',
        fields: 'spend,date_start',
        time_range,
        time_increment: 'monthly',
        access_token: metaToken,
        limit: '100'
      });
      const url = `https://graph.facebook.com/v19.0/${formattedId}/insights?${query.toString()}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        for (const item of json.data || []) {
          const month = item.date_start.slice(0, 7);
          spends[month] = parseFloat(item.spend || '0');
        }
        console.log('Successfully fetched real Meta spends for 2025.');
      }
    } catch (e) {
      console.warn('Failed to fetch real Meta spends, using generated values:', e.message);
    }
  }
  return spends;
}

async function run() {
  const metaUSDSpends = await getMetaUSDSpends();
  const rows = [];

  // Generate monthly rows for 2025
  for (let m = 1; m <= 12; m++) {
    const monthStr = String(m).padStart(2, '0');
    const monthKey = `2025-${monthStr}`;

    // 1. Rent expense: ৳21,000
    rows.push({
      date: `${monthKey}-01`,
      type: 'expense',
      category: 'rent',
      description: `Office/Warehouse Rent — ${monthKey}`,
      amount: 21000,
      payment_method: 'Bank Transfer'
    });

    // 2. Salary expense: ৳8,000
    rows.push({
      date: `${monthKey}-01`,
      type: 'expense',
      category: 'salary',
      description: `Staff salary — ${monthKey}`,
      amount: 8000,
      payment_method: 'Cash'
    });

    // 3. Fabric (COGS): ৳124,000
    rows.push({
      date: `${monthKey}-01`,
      type: 'expense',
      category: 'fabric',
      description: `Procurement Fabric roll batch — ${monthKey}`,
      amount: 124000,
      payment_method: 'Bank Transfer'
    });

    // 4. Photoshoot: ৳17,290
    rows.push({
      date: `${monthKey}-05`,
      type: 'expense',
      category: 'photoshoot',
      description: `Creative photoshoot & editing — ${monthKey}`,
      amount: 17290,
      payment_method: 'Cash'
    });

    // 5. Prepaid Sales: ৳35,000 (representing credit/bKash prepaid sales)
    rows.push({
      date: `${monthKey}-15`,
      type: 'income',
      category: 'sales_prepaid',
      description: `Prepaid sales (bKash/SSLCommerz) ledger — ${monthKey}`,
      amount: 35000,
      payment_method: 'Mobile Wallet'
    });

    // 6. Direct Sales COD: ৳20,000
    rows.push({
      date: `${monthKey}-20`,
      type: 'income',
      category: 'sales_cod',
      description: `Direct COD orders (Non-Pathao channels) — ${monthKey}`,
      amount: 20000,
      payment_method: 'Cash'
    });

    // 7. Meta Ads: USD spend converted at 130 + 15% VAT
    const usdSpend = metaUSDSpends[monthKey] || 500;
    const bdtSpend = Math.round(usdSpend * 130 * 1.15);
    rows.push({
      date: `${monthKey}-28`,
      type: 'expense',
      category: 'ads_meta',
      description: `Meta Ads monthly billing ($${usdSpend.toFixed(2)} USD converted to BDT) — ${monthKey}`,
      amount: bdtSpend,
      payment_method: 'Credit Card'
    });
  }

  console.log(`Prepared ${rows.length} rows for insertion.`);

  // Verify first if we already have 2025 transactions to avoid duplicate seeding
  const checkUrl = `${SUPABASE_URL}/rest/v1/fin_transactions?date=gte.2025-01-01&date=lte.2025-12-31&select=id`;
  const checkRes = await fetch(checkUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (existing.length > 0) {
      console.log(`Found ${existing.length} existing transactions for 2025. Skipping seeding to prevent duplicates.`);
      return;
    }
  }

  // Insert into DB
  const res = await fetch(`${SUPABASE_URL}/rest/v1/fin_transactions`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Seeding failed:', err);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`✓ Successfully seeded ${data.length} transactions for 2025 in the database.`);
}

run();
