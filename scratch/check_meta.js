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

const GRAPH_API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function run() {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;
  const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const now = new Date();
  const sinceDate = new Date(2025, 0, 1);
  const since = sinceDate.toISOString().slice(0, 10);
  const until = now.toISOString().slice(0, 10);
  const time_range = JSON.stringify({ since, until });

  const query = new URLSearchParams({
    level: 'account',
    fields: 'spend,impressions,clicks,purchase_roas,actions,action_values,date_start,date_stop',
    time_range,
    time_increment: 'monthly',
    access_token: accessToken,
    limit: '100',
  });

  const url = `${BASE_URL}/${formattedId}/insights?${query.toString()}`;
  const res = await fetch(url);
  const json = await res.json();
  console.log('Meta API status:', res.status);
  console.log('Meta API response data length:', json.data?.length);
  if (json.data) {
    console.log('Recent 2026 data from Meta:', json.data.filter(d => d.date_start.startsWith('2026')));
  } else {
    console.log('Meta Response:', json);
  }
}

run();
