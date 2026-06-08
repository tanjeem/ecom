const SUPABASE_URL = 'https://vhvioxzmanwbcuxzcuga.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodmlveHptYW53YmN1eHpjdWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTY2MjQsImV4cCI6MjA5NjQ5MjYyNH0.NAyc8GADmCY3vk2e4JL-eN6TgTF_9_kNfm8CawluuJo';

const rows = [
  // ─── FABRIC ────────────────────────────────────────────────────────────────
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Panjabi Blue fabric (105 gauge, ৳260/kg, 53 pcs)',          amount:27300,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Panjabi Maroon fabric (120 gauge, ৳260/kg, 60 pcs)',        amount:31200,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Bootcut Black fabric (109 gauge, ৳240/kg, 75 pcs)',         amount:26160,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Bootcut Grey Stripe fabric (100 gauge, ৳240/kg, 69 pcs)',   amount:24000,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Bootcut Cream fabric (65 gauge, ৳180/kg, 45 pcs)',          amount:11700,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Denim Bootcut Indigo fabric (83 gauge, ৳140/kg, 57 pcs)',   amount:11620,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Denim Bootcut Indigo fabric (92 gauge, ৳140/kg, 63 pcs)',   amount:12880,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Denim Bootcut Indigo fabric (112 gauge, ৳140/kg, 77 pcs)',  amount:15680,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'fabric', description:'Denim Bootcut Black fabric (89 gauge, ৳150/kg, 61 pcs)',    amount:13350,  payment_method:'Bank Transfer' },

  // ─── ACCESSORIES — cuff & button per variant ───────────────────────────────
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Panjabi cuff & button — Blue (53 pcs × ৳160)',         amount:8480,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Panjabi cuff & button — Maroon (60 pcs × ৳160)',       amount:9600,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Bootcut button — Black (75 pcs × ৳50)',                amount:3750,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Bootcut button — Grey Stripe (69 pcs × ৳50)',          amount:3450,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Bootcut button — Cream (45 pcs × ৳50)',                amount:2250,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Denim Bootcut button — Indigo (57 pcs × ৳30)',         amount:1710,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Denim Bootcut button — Indigo (63 pcs × ৳30)',         amount:1890,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Denim Bootcut button — Indigo (77 pcs × ৳30)',         amount:2310,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Denim Bootcut button — Black (61 pcs × ৳30)',          amount:1830,  payment_method:'Cash' },

  // ─── ACCESSORIES — MSC items ───────────────────────────────────────────────
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Panjabi Button (490 pcs × ৳5)',                        amount:2450,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Formal Bootcut Buckles (270 × ৳15)',                   amount:4050,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Formal Bootcut Hooks (280 × ৳1.8)',                    amount:504,   payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Formal Bootcut Pocketing (2 × ৳1050)',                 amount:2100,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Formal Bootcut Zippers (3 × ৳200)',                    amount:600,   payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Panjabi Red Cuff (9 × ৳680)',                          amount:6120,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Panjabi Blue Cuff (11 × ৳350)',                        amount:3850,  payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'accessories', description:'Formal Bootcut Hooks (extra)',                         amount:300,   payment_method:'Cash' },

  // ─── SEWING / MANUFACTURING ────────────────────────────────────────────────
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Panjabi manufacturing — Blue (53 pcs × ৳320)',              amount:16800,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Panjabi manufacturing — Maroon (60 pcs × ৳320)',            amount:19200,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Bootcut manufacturing — Black (75 pcs)',                    amount:24055,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Bootcut manufacturing — Grey Stripe (69 pcs)',              amount:22069,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Bootcut manufacturing — Cream (45 pcs)',                    amount:14345,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Denim Bootcut manufacturing — Indigo (57 pcs × ৳340)',      amount:21179,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Denim Bootcut manufacturing — Indigo (63 pcs × ৳340)',      amount:23476,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Denim Bootcut manufacturing — Indigo (77 pcs × ৳340)',      amount:28579,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Denim Bootcut manufacturing — Black (61 pcs × ৳340)',       amount:22710,  payment_method:'Bank Transfer' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Labor (MSC)',                                               amount:500,    payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'sewing', description:'Panjabi + Pant pasting',                                   amount:1430,   payment_method:'Cash' },

  // ─── PACKAGING — per-SKU COGS column ──────────────────────────────────────
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Panjabi Blue',              amount:1000,   payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Panjabi Maroon',            amount:1000,   payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Bootcut Black',             amount:718,    payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Bootcut Grey Stripe',       amount:718,    payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Bootcut Cream',             amount:631,    payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Denim Indigo (57 pcs)',     amount:573,    payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Denim Indigo (63 pcs)',     amount:573,    payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Denim Indigo (77 pcs)',     amount:573,    payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'packaging_material', description:'Per-SKU finishing — Denim Black',               amount:557.5,  payment_method:'Cash' },

  // ─── TRANSPORT ─────────────────────────────────────────────────────────────
  { date:'2026-05-01', type:'expense', category:'transport', description:'Production transport',                                   amount:700,   payment_method:'Cash' },
  { date:'2026-05-01', type:'expense', category:'transport', description:'Transport (MSC)',                                        amount:250,   payment_method:'Cash' },
];

// Summary
const byCategory = {};
for (const r of rows) byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
console.log('\nExpected totals by category:');
for (const [cat, total] of Object.entries(byCategory))
  console.log(`  ${cat.padEnd(22)} ৳${total.toLocaleString()}`);
console.log(`  ${'GRAND TOTAL'.padEnd(22)} ৳${Object.values(byCategory).reduce((a,b) => a+b, 0).toLocaleString()}`);
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
console.log(`\n✓ Inserted ${data.length} transactions for May 2026`);
