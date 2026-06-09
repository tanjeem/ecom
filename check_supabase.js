require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase.from('fin_transactions').select('*').in('category', ['sales_cod', 'sales_prepaid', 'other_income']);
  if (error) { console.error(error); return; }
  console.log('Manual sales transactions:', data);
}
run();
