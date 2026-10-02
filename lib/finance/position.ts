import { supabase } from '@/lib/supabase';
import { fetchTransactions } from '@/lib/finance/summary';
import { getFinanceSettings } from '@/lib/finance/products';
import { getPathaoInvoiceLines } from '@/lib/integrations/pathao';
import { addDays, todayISO } from '@/lib/finance/periods';

const TRANSFER_IN = new Set(['owner_investment', 'loan_received']);

/**
 * Where the money is right now: each account's balance (opening balance +
 * recorded movements in its payment methods since the opening date, plus
 * Pathao payouts into the chosen account), vendor balances owed, and runway.
 */
export async function getCashPosition() {
  const today = todayISO();
  const [{ data: accounts, error }, settings, lines, vendorRes] = await Promise.all([
    supabase.from('fin_accounts').select('*').eq('is_active', true).order('sort_order'),
    getFinanceSettings(),
    getPathaoInvoiceLines().catch(() => []),
    Promise.all([
      supabase.from('fin_fabric_purchases').select('vendor_id, total_cost, amount_paid, fin_vendors(name)'),
      supabase.from('fin_accessory_purchases').select('vendor_id, total_cost, amount_paid, fin_vendors(name)'),
    ]),
  ]);
  if (error) throw new Error(error.message);

  const accs = accounts || [];
  const earliest = accs.reduce((m: string, a: any) => (a.opening_date < m ? a.opening_date : m), today);
  const window90 = addDays(today, -89);
  const txs = await fetchTransactions(earliest < window90 ? earliest : window90, today);

  const signed = (t: { type: string; category: string; amount: number }) =>
    t.type === 'income' || (t.type === 'transfer' && TRANSFER_IN.has(t.category)) ? t.amount : -t.amount;

  const claimed = new Set<string>();
  const balances = accs.map((a: any) => {
    const methods = new Set<string>(a.payment_methods || []);
    let movement = 0;
    for (const t of txs) {
      if (t.date < a.opening_date || !methods.has(t.payment_method || '')) continue;
      if (t.category === 'pathao_payout' && a.id === settings.pathaoPayoutAccount) continue; // counted from invoices below
      movement += signed(t);
    }
    for (const m of methods) claimed.add(m);
    let pathao = 0;
    if (a.id === settings.pathaoPayoutAccount) {
      for (const l of lines) if (l.paid_date && l.paid_date >= a.opening_date && l.paid_date <= today) pathao += l.payout;
    }
    return {
      id: a.id, name: a.name, kind: a.kind, opening_balance: Number(a.opening_balance), opening_date: a.opening_date,
      movement, pathao, balance: Number(a.opening_balance) + movement + pathao,
    };
  });

  // Payment methods used in the last 90 days that no account claims — their money isn't in any balance
  const unassigned = new Map<string, number>();
  for (const t of txs) {
    if (t.date < window90 || claimed.has(t.payment_method || '')) continue;
    unassigned.set(t.payment_method || 'Other', (unassigned.get(t.payment_method || 'Other') || 0) + 1);
  }

  // Runway from the last 90 days of actual cash movement (ledger + Pathao payouts)
  let net90 = 0;
  for (const t of txs) if (t.date >= window90 && t.category !== 'pathao_payout') net90 += signed(t);
  for (const l of lines) if (l.paid_date && l.paid_date >= window90 && l.paid_date <= today) net90 += l.payout;
  const monthlyNet = net90 / 3;
  const cash = balances.reduce((s: number, b: any) => s + b.balance, 0);
  const runwayMonths = accs.length && monthlyNet < 0 ? cash / -monthlyNet : null;

  const owed = new Map<string, { name: string; due: number }>();
  for (const res of vendorRes) {
    for (const p of res.data || []) {
      const due = Number(p.total_cost) - Number(p.amount_paid);
      if (due <= 0) continue;
      const name = (p as any).fin_vendors?.name || 'Unknown vendor';
      const o = owed.get(name) || { name, due: 0 };
      o.due += due;
      owed.set(name, o);
    }
  }

  return {
    accounts: balances,
    totalCash: cash,
    monthlyNet,
    runwayMonths,
    unassignedMethods: [...unassigned.entries()].map(([method, count]) => ({ method, count })),
    pathaoPayoutAccount: settings.pathaoPayoutAccount,
    vendorDues: [...owed.values()].sort((a, b) => b.due - a.due),
    totalVendorDue: [...owed.values()].reduce((s, o) => s + o.due, 0),
  };
}
