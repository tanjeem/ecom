const fs = require('fs');
const path = require('path');

let supabaseUrl = 'https://vhvioxzmanwbcuxzcuga.supabase.co';
let supabaseKey = '';

if (fs.existsSync(path.join(__dirname, '../.env.local'))) {
  const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
      if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') supabaseKey = value;
    }
  });
}

async function run() {
  const res = await fetch(`${supabaseUrl}/rest/v1/fin_transactions?select=date,amount,category,type`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  if (!res.ok) {
    console.error('Fetch failed:', res.status, await res.text());
    return;
  }
  const data = await res.json();
  console.log(`Fetched ${data.length} total transactions.`);
  
  const typeCounts = {};
  const catCounts = {};
  const yearMonths = {};
  
  for (const item of data) {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    catCounts[item.category] = (catCounts[item.category] || 0) + 1;
    const ym = item.date ? item.date.slice(0, 7) : 'no-date';
    yearMonths[ym] = (yearMonths[ym] || 0) + 1;
  }
  
  console.log('Type counts:', typeCounts);
  console.log('Category counts:', catCounts);
  console.log('Year-Month counts:', yearMonths);
}

run();
