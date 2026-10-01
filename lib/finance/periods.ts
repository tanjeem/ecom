// Date-range helpers shared by the finance API and UI. Everything works on
// local-calendar ISO date strings (YYYY-MM-DD) so a "day" never shifts across
// a timezone boundary.

export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type PeriodMode = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type CompareMode = 'previous' | 'yoy' | 'none';

// Bangladesh business weeks run Saturday → Friday
export const WEEK_START = 6;

// First month the business has data for — "All time" starts here
export const DATA_START = '2025-01-01';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};

export const todayISO = () => toISO(new Date());

export const addDays = (iso: string, n: number) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Adds months, clamping the day so Jan 31 + 1 month = Feb 28/29. */
export const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toISO(target);
};

export const daysInMonth = (iso: string) => {
  const d = parseISO(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

/** Inclusive day count between two ISO dates. */
export const daysBetween = (from: string, to: string) =>
  Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000) + 1;

export const minISO = (a: string, b: string) => (a < b ? a : b);
export const maxISO = (a: string, b: string) => (a > b ? a : b);

export const startOfWeek = (iso: string) => {
  const d = parseISO(iso);
  const diff = (d.getDay() - WEEK_START + 7) % 7;
  return addDays(iso, -diff);
};

export const startOf = (iso: string, unit: Granularity): string => {
  const [y, m] = iso.split('-').map(Number);
  switch (unit) {
    case 'day': return iso;
    case 'week': return startOfWeek(iso);
    case 'month': return `${y}-${pad(m)}-01`;
    case 'quarter': return `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`;
    case 'year': return `${y}-01-01`;
  }
};

export const endOf = (iso: string, unit: Granularity): string => {
  const s = startOf(iso, unit);
  switch (unit) {
    case 'day': return s;
    case 'week': return addDays(s, 6);
    case 'month': return addDays(addMonths(s, 1), -1);
    case 'quarter': return addDays(addMonths(s, 3), -1);
    case 'year': return addDays(addMonths(s, 12), -1);
  }
};

const shiftByUnit = (iso: string, unit: Granularity, n: number) => {
  switch (unit) {
    case 'day': return addDays(iso, n);
    case 'week': return addDays(iso, 7 * n);
    case 'month': return addMonths(iso, n);
    case 'quarter': return addMonths(iso, 3 * n);
    case 'year': return addMonths(iso, 12 * n);
  }
};

// ─── buckets ────────────────────────────────────────────────────────────────

export interface Bucket { key: string; label: string; from: string; to: string }

const fmtDay = (iso: string) => {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export function bucketLabel(start: string, unit: Granularity, multiYear: boolean): string {
  const [y, m] = start.split('-').map(Number);
  const yy = `’${String(y).slice(2)}`;
  switch (unit) {
    case 'day': return fmtDay(start);
    case 'week': return fmtDay(start);
    case 'month': return multiYear ? `${MONTHS[m - 1]} ${yy}` : MONTHS[m - 1];
    case 'quarter': return `Q${Math.floor((m - 1) / 3) + 1} ${yy}`;
    case 'year': return String(y);
  }
}

/** Every bucket overlapping [from, to], each clipped to the range. */
export function bucketsInRange(from: string, to: string, unit: Granularity): Bucket[] {
  const out: Bucket[] = [];
  const multiYear = from.slice(0, 4) !== to.slice(0, 4);
  let cursor = startOf(from, unit);
  // Hard cap so a bad request can never build an unbounded array
  while (cursor <= to && out.length < 2000) {
    const end = endOf(cursor, unit);
    // Day/week labels show the clipped start so the first bar never reads as before the range
    const shown = unit === 'day' || unit === 'week' ? maxISO(cursor, from) : cursor;
    out.push({
      key: cursor,
      label: bucketLabel(shown, unit, multiYear),
      from: maxISO(cursor, from),
      to: minISO(end, to),
    });
    cursor = addDays(end, 1);
  }
  return out;
}

export const bucketKeyFor = (iso: string, unit: Granularity) => startOf(iso, unit);

/** Sensible chart granularity for a range length. */
export function autoGranularity(from: string, to: string): Granularity {
  const days = daysBetween(from, to);
  if (days <= 45) return 'day';
  if (days <= 190) return 'week';
  if (days <= 800) return 'month';
  return 'quarter';
}

/** Granularities that produce a readable number of buckets for this range. */
export function allowedGranularities(from: string, to: string): Granularity[] {
  const days = daysBetween(from, to);
  const all: Granularity[] = ['day', 'week', 'month', 'quarter', 'year'];
  return all.filter(g => {
    const n = bucketsInRange(from, to, g).length;
    if (g === 'day') return days <= 120;
    return n >= 1 && n <= 120;
  });
}

// ─── periods (what the filter bar selects) ─────────────────────────────────

export interface PeriodRange { from: string; to: string }

export function rangeFor(mode: PeriodMode, anchor: string, custom?: PeriodRange): PeriodRange {
  if (mode === 'custom') {
    const from = custom?.from || startOf(anchor, 'month');
    const to = custom?.to || anchor;
    return from <= to ? { from, to } : { from: to, to: from };
  }
  return { from: startOf(anchor, mode), to: endOf(anchor, mode) };
}

export function shiftAnchor(mode: PeriodMode, anchor: string, n: number, custom?: PeriodRange): { anchor: string; custom?: PeriodRange } {
  if (mode === 'custom' && custom) {
    const len = daysBetween(custom.from, custom.to);
    return { anchor, custom: { from: addDays(custom.from, len * n), to: addDays(custom.to, len * n) } };
  }
  if (mode === 'custom') return { anchor };
  return { anchor: shiftByUnit(anchor, mode, n) };
}

export function periodLabel(mode: PeriodMode, range: PeriodRange): string {
  const f = parseISO(range.from);
  const t = parseISO(range.to);
  const sameYear = f.getFullYear() === t.getFullYear();
  switch (mode) {
    case 'day':
      return f.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    case 'month':
      return `${f.toLocaleString('en-GB', { month: 'long' })} ${f.getFullYear()}`;
    case 'quarter':
      return `Q${Math.floor(f.getMonth() / 3) + 1} ${f.getFullYear()}`;
    case 'year':
      return String(f.getFullYear());
    default: {
      const left = `${f.getDate()} ${MONTHS[f.getMonth()]}${sameYear ? '' : ` ${f.getFullYear()}`}`;
      const right = `${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
      return range.from === range.to ? right : `${left} – ${right}`;
    }
  }
}

/**
 * The window to compare against. A period that runs past today is compared
 * like-for-like: Oct 1–15 vs Sep 1–15, not vs all of September.
 */
export function comparisonRange(mode: PeriodMode, range: PeriodRange, kind: CompareMode, today = todayISO()): PeriodRange | null {
  if (kind === 'none' || range.from > today) return null;
  const effTo = minISO(range.to, today);
  if (kind === 'yoy') return { from: addMonths(range.from, -12), to: addMonths(effTo, -12) };
  if (mode === 'custom') {
    const len = daysBetween(range.from, range.to);
    return { from: addDays(range.from, -len), to: addDays(effTo, -len) };
  }
  return { from: shiftByUnit(range.from, mode, -1), to: shiftByUnit(effTo, mode, -1) };
}

export function compareLabel(kind: CompareMode, mode: PeriodMode): string {
  if (kind === 'yoy') return 'vs last year';
  if (kind === 'none') return '';
  return {
    day: 'vs previous day', week: 'vs previous week', month: 'vs previous month',
    quarter: 'vs previous quarter', year: 'vs previous year', custom: 'vs previous period',
  }[mode];
}
