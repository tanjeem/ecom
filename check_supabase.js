const fs = require('fs');
const path = require('path');

let supabaseUrl = 'https://vhvioxzmanwbcuxzcuga.supabase.co';
let supabaseKey = '';

if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  const env = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
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
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
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
  console.log('Tables exposed in API:');
  const paths = Object.keys(data.paths || {});
  console.log(paths);
}

run();
