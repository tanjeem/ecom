const SUPABASE_URL = 'https://vhvioxzmanwbcuxzcuga.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodmlveHptYW53YmN1eHpjdWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTY2MjQsImV4cCI6MjA5NjQ5MjYyNH0.NAyc8GADmCY3vk2e4JL-eN6TgTF_9_kNfm8CawluuJo';

const rows = [
  // ─── FABRIC ────────────────────────────────────────────────────────────────
  { date:'2026-03-01', type:'expense', category:'fabric', description:'Panjabi Blue fabric (80 gauge, ৳260/kg)',       amount:20800, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'fabric', description:'Panjabi Maroon fabric (80 gauge, ৳260/kg)',     amount:20800, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'fabric', description:'Panjabi Offwhite fabric (100 gauge, ৳160/kg)', amount:16000, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'fabric', description:'Panjabi Ash fabric (100 gauge, ৳120/kg)',       amount:12000, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'fabric', description:'Panjabi Khaki fabric (100 gauge, ৳120/kg)',     amount:12000, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'fabric', description:'Panjabi Black fabric (116 gauge, ৳150/kg)',     amount:17400, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'fabric', description:'Bootcut Pant Black fabric (81 gauge, ৳200/kg)',amount:16200, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'fabric', description:'Bootcut Pant White fabric (100 gauge, ৳175/kg)',amount:17500, payment_method:'Bank Transfer' },

  // ─── ACCESSORIES (cuff+button per variant) ─────────────────────────────────
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Panjabi cuff & button — Blue (40 pcs × ৳160)',    amount:6400,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Panjabi cuff & button — Maroon (40 pcs × ৳160)',  amount:6400,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Panjabi cuff & button — Offwhite (50 pcs × ৳160)',amount:8000,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Panjabi cuff & button — Ash (48 pcs × ৳160)',     amount:7680,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Panjabi cuff & button — Khaki (50 pcs × ৳160)',   amount:8000,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Panjabi cuff & button — Black (58 pcs × ৳160)',   amount:9280,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Bootcut button — Black (51 pcs × ৳50)',            amount:2550,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Bootcut button — White (29 pcs × ৳50)',            amount:1450,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'accessories', description:'Collar accessory',                                 amount:2000,  payment_method:'Cash' },

  // ─── SEWING / MANUFACTURING ────────────────────────────────────────────────
  { date:'2026-03-01', type:'expense', category:'sewing', description:'Panjabi manufacturing — Blue (40 pcs × ৳320)',     amount:12800, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'sewing', description:'Panjabi manufacturing — Maroon (40 pcs × ৳320)',   amount:12800, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'sewing', description:'Panjabi manufacturing — Offwhite (50 pcs × ৳320)', amount:16000, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'sewing', description:'Panjabi manufacturing — Ash (48 pcs)',              amount:15238, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'sewing', description:'Panjabi manufacturing — Khaki (50 pcs × ৳320)',     amount:16000, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'sewing', description:'Panjabi manufacturing — Black (58 pcs × ৳320)',     amount:18560, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'sewing', description:'Bootcut manufacturing — Black (51 pcs)',             amount:16200, payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'sewing', description:'Bootcut manufacturing — White (29 pcs)',             amount:9143,  payment_method:'Bank Transfer' },
  { date:'2026-03-01', type:'expense', category:'sewing', description:'XL to M size alteration (50 pcs × ৳150)',            amount:7500,  payment_method:'Cash' },

  // ─── PACKAGING ─────────────────────────────────────────────────────────────
  { date:'2026-03-01', type:'expense', category:'packaging_material', description:'Panjabi boxes (400 pcs × ৳28)',    amount:11200, payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'packaging_material', description:'Folding back board (300 pcs × ৳3)',amount:900,   payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'packaging_material', description:'Poly bags',                         amount:1200,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'packaging_material', description:'Cartoon / carton boxes',            amount:600,   payment_method:'Cash' },
  // Per-SKU COGS (packaging / finishing costs per spreadsheet COGS column)
  { date:'2026-03-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing cost — Panjabi 6 variants + Bootcut 2 variants', amount:6705, payment_method:'Cash' },

  // ─── TRANSPORT ─────────────────────────────────────────────────────────────
  { date:'2026-03-01', type:'expense', category:'transport', description:'Production transport',         amount:2000, payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'transport', description:'Packing food & transport',     amount:3000, payment_method:'Cash' },

  // ─── PHOTOSHOOT ────────────────────────────────────────────────────────────
  { date:'2026-03-01', type:'expense', category:'photoshoot', description:'Photographer fee',             amount:15000, payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'photoshoot', description:'Male model — Zayan (5 shoots)',amount:15000, payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'photoshoot', description:'Male model — Aurnob (6 shoots)',amount:12000, payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'photoshoot', description:'Photoshoot miscellaneous',      amount:1000,  payment_method:'Cash' },
  { date:'2026-03-01', type:'expense', category:'photoshoot', description:'Photoshoot food',               amount:1000,  payment_method:'Cash' },
];

// Category totals for verification
const byCategory = {};
for (const r of rows) {
  byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
}
console.log('\nExpected totals by category:');
for (const [cat, total] of Object.entries(byCategory)) {
  console.log(`  ${cat.padEnd(20)} ৳${total.toLocaleString()}`);
}
const grand = Object.values(byCategory).reduce((a, b) => a + b, 0);
console.log(`  ${'GRAND TOTAL'.padEnd(20)} ৳${grand.toLocaleString()}`);
console.log(`\nInserting ${rows.length} transactions into fin_transactions...`);

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
  console.error('Error:', err);
  process.exit(1);
}

const data = await res.json();
console.log(`\n✓ Inserted ${data.length} transactions for March 2026`);
