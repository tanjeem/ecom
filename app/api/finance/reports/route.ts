import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { COGS_CATEGORIES } from '@/lib/types/finance';

function monthRange(year: number, month: number): [string, string] {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return [from, to];
}

function getDateRange(period: string, year: number, month: number, params: URLSearchParams, now: Date): [string, string] {
  if (period === 'month') return monthRange(year, month);
  if (period === 'year') return [`${year}-01-01`, `${year}-12-31`];
  return [
    params.get('date_from') || `${year}-01-01`,
    params.get('date_to') || now.toISOString().slice(0, 10),
  ];
}

function initPL() {
  return {
    revenue: { pathao_payout: 0, sales_prepaid: 0, sales_cod: 0, other_income: 0, total: 0 },
    cogs: { fabric: 0, accessories: 0, sewing: 0, packaging_material: 0, total: 0 },
    opex: { rent: 0, salary: 0, transport: 0, ads_meta: 0, ads_google: 0, photoshoot: 0, miscellaneous: 0, total: 0 },
    gross_profit: 0,
    gross_margin: 0,
    net_profit: 0,
    net_margin: 0,
  };
}

function accumulate(pl: ReturnType<typeof initPL>, transactions: { type: string; category: string; amount: number }[]) {
  for (const t of transactions) {
    const amount = Number(t.amount);
    if (t.type === 'income') {
      if (t.category in pl.revenue) (pl.revenue as Record<string, number>)[t.category] += amount;
      pl.revenue.total += amount;
    } else if (t.type === 'expense') {
      if (COGS_CATEGORIES.includes(t.category)) {
        if (t.category in pl.cogs) (pl.cogs as Record<string, number>)[t.category] += amount;
        pl.cogs.total += amount;
      } else if (t.category in pl.opex) {
        (pl.opex as Record<string, number>)[t.category] += amount;
        pl.opex.total += amount;
      }
    }
  }
}

function buildTrend(
  trendData: { date: string; type: string; amount: number }[],
  fixedCosts: { id: string; default_amount: number }[],
  fixedMonths: { fixed_cost_id: string; month: string; amount: number }[],
  year: number,
) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    const monthTx = trendData.filter(t => Number.parseInt(t.date.slice(5, 7), 10) === m);
    const revenue = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    let expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    for (const fc of fixedCosts) {
      const ov = fixedMonths.find(fm => fm.fixed_cost_id === fc.id && fm.month === monthKey);
      expenses += ov == null ? Number(fc.default_amount) : Number(ov.amount);
    }
    return { month: m, revenue, expenses, profit: revenue - expenses };
  });
}

function applyFixedCosts(
  pl: ReturnType<typeof initPL>,
  monthKey: string,
  fixedCosts: { id: string; category: string; default_amount: number }[],
  fixedMonths: { fixed_cost_id: string; month: string; amount: number }[],
) {
  for (const fc of fixedCosts) {
    const ov = fixedMonths.find(fm => fm.fixed_cost_id === fc.id && fm.month === monthKey);
    const amount = ov == null ? Number(fc.default_amount) : Number(ov.amount);
    if (amount === 0) continue;
    const cat = fc.category as keyof typeof pl.opex;
    if (cat in pl.opex) {
      (pl.opex as Record<string, number>)[cat] += amount;
    } else {
      pl.opex.miscellaneous += amount;
    }
    pl.opex.total += amount;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'month';
  const now = new Date();
  const year = Number.parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
  const month = Number.parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

  const [dateFrom, dateTo] = getDateRange(period, year, month, searchParams, now);

  const [txRes, trendRes, fixedCostsRes, fixedMonthsRes] = await Promise.all([
    supabase.from('fin_transactions').select('type, category, amount').gte('date', dateFrom).lte('date', dateTo),
    supabase.from('fin_transactions').select('date, type, amount').gte('date', `${year}-01-01`).lte('date', `${year}-12-31`),
    supabase.from('fin_fixed_costs').select('id, category, default_amount'),
    supabase.from('fin_fixed_cost_months').select('fixed_cost_id, month, amount').gte('month', `${year}-01`).lte('month', `${year}-12`),
  ]);

  if (txRes.error) return NextResponse.json({ error: txRes.error.message }, { status: 500 });

  const fixedCosts = fixedCostsRes.data || [];
  const fixedMonths = fixedMonthsRes.data || [];

  const pl = initPL();
  accumulate(pl, txRes.data || []);

  if (period === 'month') {
    applyFixedCosts(pl, `${year}-${String(month).padStart(2, '0')}`, fixedCosts, fixedMonths);
  } else if (period === 'year') {
    for (let m = 1; m <= 12; m++) {
      applyFixedCosts(pl, `${year}-${String(m).padStart(2, '0')}`, fixedCosts, fixedMonths);
    }
  }

  pl.gross_profit = pl.revenue.total - pl.cogs.total;
  pl.gross_margin = pl.revenue.total > 0 ? (pl.gross_profit / pl.revenue.total) * 100 : 0;
  pl.net_profit = pl.gross_profit - pl.opex.total;
  pl.net_margin = pl.revenue.total > 0 ? (pl.net_profit / pl.revenue.total) * 100 : 0;

  const trend = buildTrend(trendRes.data || [], fixedCosts, fixedMonths, year);

  return NextResponse.json({ pl, period: { from: dateFrom, to: dateTo }, trend });
}
