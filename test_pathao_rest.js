require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function testPathao() {
  const loginRes = await fetch("https://merchant.pathao.com/api/v1/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: process.env.PATHAO_USERNAME,
      password: process.env.PATHAO_PASSWORD,
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.access_token;
  
  const params = new URLSearchParams({ per_page: '100', page: '1', from_date: '2026-01-01', to_date: '2026-01-31' });
  const res = await fetch(`https://merchant.pathao.com/api/v1/orders/all?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  const data = await res.json();
  console.log("Jan 2026 total orders:", data?.data?.total);
}
testPathao().catch(console.error);
