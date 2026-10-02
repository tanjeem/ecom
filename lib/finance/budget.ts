import { addDays, daysInMonth, maxISO, minISO, type PeriodRange } from './periods';

export type Budget = { id: string; month: string | null; scope: string; amount: number };

/**
 * A monthly budget prorated to any range by calendar days. A month-specific
 * entry overrides the default (month = null). Returns null when no budget
 * covers the scope at all.
 */
export function budgetForRange(budgets: Budget[], range: PeriodRange, scope: string): number | null {
  let total = 0;
  let any = false;
  let cursor = range.from;
  while (cursor <= range.to) {
    const month = cursor.slice(0, 7);
    const dim = daysInMonth(cursor);
    const segEnd = minISO(addDays(`${month}-01`, dim - 1), range.to);
    const days = (Date.parse(segEnd) - Date.parse(maxISO(cursor, range.from))) / 86_400_000 + 1;
    const b = budgets.find(x => x.month === month && x.scope === scope) ?? budgets.find(x => x.month == null && x.scope === scope);
    if (b) { any = true; total += Number(b.amount) * (days / dim); }
    cursor = addDays(segEnd, 1);
  }
  return any ? total : null;
}
