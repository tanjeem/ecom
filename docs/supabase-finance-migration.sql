-- ============================================================
-- ThreadOps Finance System — Supabase Migration
-- Run this in your Supabase project SQL Editor
-- ============================================================

-- 1. Vendors master list
CREATE TABLE IF NOT EXISTS fin_vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  phone TEXT,
  bank_details TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Main transaction ledger (every BDT movement goes here)
CREATE TABLE IF NOT EXISTS fin_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  vendor_id UUID REFERENCES fin_vendors(id) ON DELETE SET NULL,
  reference_no TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Fabric purchases (detailed procurement records)
CREATE TABLE IF NOT EXISTS fin_fabric_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES fin_transactions(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES fin_vendors(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  fabric_type TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'yards',
  unit_price NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Received',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Accessory purchases (buttons, zippers, labels, etc.)
CREATE TABLE IF NOT EXISTS fin_accessory_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES fin_transactions(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES fin_vendors(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  item TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC(10,2),
  total_cost NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Production / sewing batches
CREATE TABLE IF NOT EXISTS fin_production_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_code TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_type TEXT NOT NULL,
  target_quantity INTEGER NOT NULL,
  factory TEXT,
  estimated_sewing_cost NUMERIC(12,2),
  actual_sewing_cost NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'In Progress',
  completion_date DATE,
  completed_quantity INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_fin_tx_date     ON fin_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_type     ON fin_transactions(type);
CREATE INDEX IF NOT EXISTS idx_fin_tx_category ON fin_transactions(category);
CREATE INDEX IF NOT EXISTS idx_fin_tx_vendor   ON fin_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_fin_fabric_date ON fin_fabric_purchases(date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_acc_date    ON fin_accessory_purchases(date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_prod_date   ON fin_production_batches(date DESC);

-- ============================================================
-- RLS POLICIES (choose one approach)
-- ============================================================
-- Option A: Disable RLS entirely (simplest for private internal tool)
ALTER TABLE fin_vendors              DISABLE ROW LEVEL SECURITY;
ALTER TABLE fin_transactions         DISABLE ROW LEVEL SECURITY;
ALTER TABLE fin_fabric_purchases     DISABLE ROW LEVEL SECURITY;
ALTER TABLE fin_accessory_purchases  DISABLE ROW LEVEL SECURITY;
ALTER TABLE fin_production_batches   DISABLE ROW LEVEL SECURITY;

-- Option B: Enable RLS + allow all for anon key (if you prefer RLS on)
-- ALTER TABLE fin_transactions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all" ON fin_transactions FOR ALL USING (true);
-- (repeat for each table)
