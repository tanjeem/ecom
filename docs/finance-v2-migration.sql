-- Finance v2: product costs, accounts, budgets, recurring entries, persisted
-- Pathao invoices and receipt attachments. Idempotent — safe to re-run.

create table if not exists fin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into fin_settings (key, value) values
  ('cogs_method', '"per_unit"'),        -- 'per_unit' (cost follows sales) or 'cash' (expensed when paid)
  ('default_unit_cost', 'null'),        -- null = average of production batches
  ('pathao_payout_account', 'null')     -- fin_accounts.id that Pathao payouts land in
on conflict (key) do nothing;

create table if not exists fin_product_costs (
  product_id bigint primary key,        -- WooCommerce product id
  name text not null,
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists fin_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'bank' check (kind in ('cash', 'bank', 'mobile', 'card')),
  payment_methods text[] not null default '{}',   -- fin_transactions.payment_method values that move this account
  opening_balance numeric(14,2) not null default 0,
  opening_date date not null default current_date,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists fin_budgets (
  id uuid primary key default gen_random_uuid(),
  month text,                            -- 'YYYY-MM', or null for the default every month
  scope text not null,                   -- 'revenue' target, or a cost group: production | marketing | overhead | logistics | other
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create unique index if not exists fin_budgets_month_scope on fin_budgets (coalesce(month, '*'), scope);

create table if not exists fin_recurring (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'Cash',
  vendor_id uuid references fin_vendors(id) on delete set null,
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  start_month text not null,             -- 'YYYY-MM'
  end_month text,                        -- inclusive, null = no end
  is_active boolean not null default true,
  last_posted_month text,
  created_at timestamptz not null default now()
);

create table if not exists fin_pathao_invoice_lines (
  invoice_id text not null,
  consignment_id text not null,
  invoice_created_at timestamptz not null,
  invoice_paid_at timestamptz,
  invoice_type text not null,
  merchant_order_id text,
  collected_amount numeric(12,2) not null default 0,
  final_fee numeric(12,2) not null default 0,
  payout numeric(12,2) not null default 0,
  primary key (invoice_id, consignment_id)
);

alter table fin_transactions add column if not exists receipt_path text;
alter table fin_transactions add column if not exists recurring_id uuid references fin_recurring(id) on delete set null;
alter table fin_transactions add column if not exists recurring_month text;
-- One posting per recurring entry per month, even if the cron job runs twice
create unique index if not exists fin_transactions_recurring_month
  on fin_transactions (recurring_id, recurring_month) where recurring_id is not null;
