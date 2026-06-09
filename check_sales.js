require('dotenv').config({ path: '.env.local' });
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
