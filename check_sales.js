const fs = require('fs');
const path = require('path');
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  const env = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      process.env[key] = value;
    }
  });
}
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const { rows } = await pool.query("SELECT to_char(date, 'YYYY-MM') as month, category, sum(amount) as total FROM fin_transactions WHERE category IN ('sales_cod', 'sales_prepaid', 'other_income') GROUP BY 1, 2 ORDER BY 1");
  console.log(rows);
  pool.end();
}
run();
