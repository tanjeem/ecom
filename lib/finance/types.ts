import type { Granularity } from './periods';

// USD → BDT conversion for Meta invoices: bank rate plus 15% VAT on foreign ad spend
export const META_USD_TO_BDT = 130;
export const META_VAT_RATE = 0.15;
export const metaUsdToBdt = (usd: number) => usd * META_USD_TO_BDT * (1 + META_VAT_RATE);

/**
 * Expense categories rolled up into the five groups the dashboard charts.
 * `courier_fees` is synthetic — it comes from Pathao order fees, not the ledger.
 */
export const COST_GROUPS = [
  { key: 'production', label: 'Production', cats: ['fabric', 'accessories', 'sewing', 'packaging_material'] },
  { key: 'marketing',  label: 'Marketing',  cats: ['ads_meta', 'ads_google', 'photoshoot'] },
  { key: 'overhead',   label: 'Rent & Salary', cats: ['rent', 'salary'] },
  { key: 'logistics',  label: 'Logistics',  cats: ['courier_fees', 'transport'] },
  { key: 'other',      label: 'Other',      cats: ['miscellaneous'] },
] as const;

export type CostGroupKey = typeof COST_GROUPS[number]['key'];

export interface PLBreakdown {
  revenue: { pathao_cod: number; sales_prepaid: number; sales_cod: number; other_income: number; total: number };
  cogs: { fabric: number; accessories: number; sewing: number; packaging_material: number; total: number };
  opex: {
    rent: number; salary: number; transport: number; courier_fees: number;
    ads_meta: number; ads_google: number; photoshoot: number; miscellaneous: number; total: number;
  };
  groups: Record<CostGroupKey, number>;
  expenses: number;
  gross_profit: number;
  gross_margin: number;
  net_profit: number;
  net_margin: number;
}

export interface SeriesPoint {
  key: string;
  label: string;
  from: string;
  to: string;
  revenue: number;
  expenses: number;
  gross: number;
  net: number;
  delivered: number;
  returned: number;
  groups: Record<CostGroupKey, number>;
  /** Raw per-category amounts (ledger categories + pathao_cod + courier_fees) */
  cats: Record<string, number>;
}

export interface OrderStats {
  delivered: { count: number; amount: number };
  returned: { count: number; amount: number };
  inProcess: { count: number; amount: number };
  courierFees: number;
  aov: number;
  returnRate: number;
}

export interface CashFlow {
  inflow: number;
  outflow: number;
  net: number;
  byMethod: { method: string; inflow: number; outflow: number }[];
  transfers: Record<string, number>;
  pathaoPayouts: number;
}

export interface InvoiceSummary {
  lastInvoiceDate: string | null;
  paymentSent: number;
  lifetimeEarning: number;
  inTransit: number;
}

export interface FinanceSummary {
  range: { from: string; to: string; days: number; elapsedDays: number };
  granularity: Granularity;
  pl: PLBreakdown;
  series: SeriesPoint[];
  orders: OrderStats;
  cash: CashFlow;
  topCategories: { category: string; amount: number; count: number }[];
  topVendors: { name: string; amount: number; count: number }[];
  txCount: number;
  invoice: InvoiceSummary | null;
  sources: { meta: 'api' | 'ledger'; pathao: boolean; fixedCosts: number };
  warnings: string[];
}
