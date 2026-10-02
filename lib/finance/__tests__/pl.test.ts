import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plFromCats } from '../pl';
import { budgetForRange } from '../budget';

test('P&L folds categories into revenue, COGS and operating costs', () => {
  const pl = plFromCats({
    pathao_cod: 100_000, sales_prepaid: 20_000, product_cost: 40_000, courier_fees: 6_000, ads_meta: 15_000, rent: 9_000,
  });
  // Revenue is Pathao collected only; manual income lands below operating profit
  assert.equal(pl.revenue.total, 100_000);
  assert.equal(pl.cogs.total, 40_000);
  assert.equal(pl.gross_profit, 60_000);
  assert.equal(pl.opex.total, 30_000);
  assert.equal(pl.operating_profit, 30_000);
  assert.equal(pl.other_income, 20_000);
  assert.equal(pl.net_profit, 50_000);
  assert.equal(pl.net_margin, 50);
  assert.equal(pl.groups.production, 40_000);
  assert.equal(pl.groups.marketing, 15_000);
  assert.equal(pl.groups.logistics, 6_000);
  assert.equal(pl.expenses, 70_000);
});

test('no revenue means zero margins, not NaN', () => {
  const pl = plFromCats({ rent: 1000 });
  assert.equal(pl.gross_margin, 0);
  assert.equal(pl.net_margin, 0);
  assert.equal(pl.net_profit, -1000);
});

test('Pathao payouts in the ledger are not revenue', () => {
  // Invoices are the revenue source; a stray pathao_payout key must not count
  assert.equal(plFromCats({ pathao_payout: 50_000 }).revenue.total, 0);
});

test('budgets prorate by calendar days and month overrides win', () => {
  const budgets = [
    { id: '1', month: null, scope: 'marketing', amount: 30_000 },
    { id: '2', month: '2026-09', scope: 'marketing', amount: 60_000 },
  ];
  assert.equal(budgetForRange(budgets, { from: '2026-10-01', to: '2026-10-31' }, 'marketing'), 30_000);
  assert.equal(budgetForRange(budgets, { from: '2026-09-01', to: '2026-09-30' }, 'marketing'), 60_000);
  // Half of September (override) + first 5 days of October (default)
  const mixed = budgetForRange(budgets, { from: '2026-09-16', to: '2026-10-05' }, 'marketing')!;
  assert.equal(Math.round(mixed), Math.round(60_000 * 15 / 30 + 30_000 * 5 / 31));
  assert.equal(budgetForRange(budgets, { from: '2026-10-01', to: '2026-10-31' }, 'revenue'), null);
});
