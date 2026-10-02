-- Audit trail for stock counts changed from the Inventory tab
create table if not exists inv_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null,
  variation_id bigint,
  product_name text not null,
  size text,
  before_qty int not null,
  after_qty int not null,
  reason text not null check (reason in ('restock', 'count', 'damaged', 'return', 'sample', 'other')),
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists inv_adjustments_created on inv_adjustments (created_at desc);
