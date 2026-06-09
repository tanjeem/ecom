const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '../.env.local'))) {
  const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      process.env[key] = value;
    }
  });
}

async function testPathao() {
  const username = process.env.PATHAO_USERNAME;
  const password = process.env.PATHAO_PASSWORD;
  console.log('Using username:', username);

  try {
    console.log('Logging in to Pathao...');
    const loginRes = await fetch("https://merchant.pathao.com/api/v1/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!loginRes.ok) {
      console.error('Login failed status:', loginRes.status);
      console.error('Login response:', await loginRes.text());
      return;
    }

    const tokenData = await loginRes.json();
    console.log('Login successful! Access token obtained.');

    const token = tokenData.access_token;
    console.log('Fetching live orders from 2026-03-01...');
    const ordersRes = await fetch(
      `https://merchant.pathao.com/api/v1/orders/all?from_date=2026-03-01&per_page=10&page=1`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      }
    );

    if (!ordersRes.ok) {
      console.error('Fetch orders failed status:', ordersRes.status);
      console.error('Fetch orders response:', await ordersRes.text());
      return;
    }

    const ordersJson = await ordersRes.json();
    console.log('Successfully fetched orders JSON structure!');
    console.log('Total orders:', ordersJson.data?.total);
    console.log('Sample orders count on page 1:', ordersJson.data?.data?.length);
    if (ordersJson.data?.data?.length > 0) {
      console.log('Sample order:', JSON.stringify(ordersJson.data.data[0], null, 2));
    }
  } catch (err) {
    console.error('Error during Pathao test:', err);
  }
}

testPathao();
