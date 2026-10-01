'use client';

// The finance period filter: one selection (Day / Week / Month / Quarter /
// Year / Custom + comparison) shared by Overview, Transactions and P&L, plus
// a cached hook for /api/finance/summary.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, Check } from 'lucide-react';
import {
  addDays, addMonths, comparisonRange, compareLabel, DATA_START, parseISO, periodLabel, rangeFor,
  shiftAnchor, startOf, todayISO, autoGranularity, allowedGranularities,
  type CompareMode, type Granularity, type PeriodMode, type PeriodRange,
} from '@/lib/finance/periods';
import type { FinanceSummary } from '@/lib/finance/types';
import { MONTHS_SHORT } from './shared';

// ─── state ──────────────────────────────────────────────────────────────────

interface PeriodState {
  mode: PeriodMode;
  anchor: string;
  custom?: PeriodRange;
  compare: CompareMode;
  granularity: Granularity | 'auto';
}

interface PeriodContextValue extends PeriodState {
  range: PeriodRange;
  compareRange: PeriodRange | null;
  label: string;
  compareText: string;
  chartGranularity: Granularity;
  granularityOptions: Granularity[];
  isCurrent: boolean;
  setMode: (m: PeriodMode) => void;
  setAnchor: (iso: string) => void;
  setCustom: (r: PeriodRange) => void;
  setCompare: (c: CompareMode) => void;
  setGranularity: (g: Granularity | 'auto') => void;
  step: (n: number) => void;
  goToday: () => void;
  applyPreset: (id: string) => void;
}

const STORAGE_KEY = 'finance.period.v1';
const PeriodContext = createContext<PeriodContextValue | null>(null);

export const usePeriod = () => {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error('usePeriod must be used inside <PeriodProvider>');
  return ctx;
};

export const PRESETS: { id: string; label: string; group: 'quick' | 'calendar' }[] = [
  { id: 'today', label: 'Today', group: 'calendar' },
  { id: 'yesterday', label: 'Yesterday', group: 'calendar' },
  { id: 'this_week', label: 'This week', group: 'calendar' },
  { id: 'this_month', label: 'This month', group: 'calendar' },
  { id: 'last_month', label: 'Last month', group: 'calendar' },
  { id: 'this_quarter', label: 'This quarter', group: 'calendar' },
  { id: 'this_year', label: 'This year', group: 'calendar' },
  { id: 'last_year', label: 'Last year', group: 'calendar' },
  { id: 'last_7', label: 'Last 7 days', group: 'quick' },
  { id: 'last_30', label: 'Last 30 days', group: 'quick' },
  { id: 'last_90', label: 'Last 90 days', group: 'quick' },
  { id: 'last_12m', label: 'Last 12 months', group: 'quick' },
  { id: 'ytd', label: 'Year to date', group: 'quick' },
  { id: 'all', label: 'All time', group: 'quick' },
];

export const PeriodProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<PeriodState>({
    mode: 'month', anchor: todayISO(), compare: 'previous', granularity: 'auto',
  });

  // Restore the viewer's last mode / comparison; the anchor always starts at today
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        setState(s => ({
          ...s,
          mode: saved.mode ?? s.mode,
          compare: saved.compare ?? s.compare,
          custom: saved.custom,
        }));
      }
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: state.mode, compare: state.compare, custom: state.custom }));
    } catch { /* storage unavailable */ }
  }, [state.mode, state.compare, state.custom]);

  const value = useMemo<PeriodContextValue>(() => {
    const today = todayISO();
    const range = rangeFor(state.mode, state.anchor, state.custom);
    const options = allowedGranularities(range.from, range.to);
    const auto = autoGranularity(range.from, range.to);
    const chartGranularity = state.granularity !== 'auto' && options.includes(state.granularity)
      ? state.granularity
      : options.includes(auto) ? auto : options[options.length - 1] ?? 'month';

    return {
      ...state,
      range,
      compareRange: comparisonRange(state.mode, range, state.compare, today),
      label: periodLabel(state.mode, range),
      compareText: compareLabel(state.compare, state.mode),
      chartGranularity,
      granularityOptions: options,
      isCurrent: range.from <= today && range.to >= today,
      setMode: mode => setState(s => {
        if (mode === 'custom') {
          const r = rangeFor(s.mode, s.anchor, s.custom);
          return { ...s, mode, custom: { from: r.from, to: r.to > today ? today : r.to }, granularity: 'auto' };
        }
        return { ...s, mode, granularity: 'auto' };
      }),
      setAnchor: anchor => setState(s => ({ ...s, anchor })),
      setCustom: custom => setState(s => ({ ...s, mode: 'custom', custom, granularity: 'auto' })),
      setCompare: compare => setState(s => ({ ...s, compare })),
      setGranularity: granularity => setState(s => ({ ...s, granularity })),
      step: n => setState(s => ({ ...s, ...shiftAnchor(s.mode, s.anchor, n, s.custom) })),
      goToday: () => setState(s => (s.mode === 'custom' ? { ...s, mode: 'month', anchor: todayISO() } : { ...s, anchor: todayISO() })),
      applyPreset: id => setState(s => {
        const t = todayISO();
        const unit = (mode: PeriodMode, anchor = t): PeriodState => ({ ...s, mode, anchor, granularity: 'auto' });
        const custom = (from: string, to = t): PeriodState => ({ ...s, mode: 'custom', custom: { from, to }, granularity: 'auto' });
        switch (id) {
          case 'today': return unit('day');
          case 'yesterday': return unit('day', addDays(t, -1));
          case 'this_week': return unit('week');
          case 'this_month': return unit('month');
          case 'last_month': return unit('month', addMonths(startOf(t, 'month'), -1));
          case 'this_quarter': return unit('quarter');
          case 'this_year': return unit('year');
          case 'last_year': return unit('year', addMonths(startOf(t, 'year'), -12));
          case 'last_7': return custom(addDays(t, -6));
          case 'last_30': return custom(addDays(t, -29));
          case 'last_90': return custom(addDays(t, -89));
          case 'last_12m': return custom(addDays(addMonths(t, -12), 1));
          case 'ytd': return custom(startOf(t, 'year'));
          case 'all': return custom(DATA_START);
          default: return s;
        }
      }),
    };
  }, [state]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
};

// ─── data hook ──────────────────────────────────────────────────────────────

const summaryCache = new Map<string, { at: number; data: FinanceSummary }>();
const CACHE_MS = 60_000;

/** Drops cached summaries, e.g. after a transaction is added or edited. */
export const invalidateFinanceCache = () => summaryCache.clear();

/**
 * Loads /api/finance/summary. Keeps the previous result on screen while a new
 * range loads, so switching periods never flashes an empty page.
 */
export function useFinanceSummary(
  range: PeriodRange | null,
  granularity: Granularity,
  opts: { invoice?: boolean } = {},
) {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(!!range);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);

  const key = range ? `${range.from}|${range.to}|${granularity}|${opts.invoice ? 1 : 0}` : '';

  useEffect(() => {
    if (!range) { setData(null); setLoading(false); return; }
    const hit = summaryCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS && nonce === 0) {
      setData(hit.data); setLoading(false); setError(null);
      return;
    }
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setLoading(true);
    const qs = new URLSearchParams({ from: range.from, to: range.to, granularity });
    if (opts.invoice) qs.set('invoice', '1');
    fetch(`/api/finance/summary?${qs}`, { signal: ctrl.signal })
      .then(async r => {
        const json = await r.json();
        if (!r.ok || json.error) throw new Error(json.error || `Request failed (${r.status})`);
        return json as FinanceSummary;
      })
      .then(json => {
        if (id !== reqId.current) return;
        summaryCache.set(key, { at: Date.now(), data: json });
        setData(json); setError(null);
      })
      .catch(e => { if (id === reqId.current && e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => { summaryCache.delete(key); setNonce(n => n + 1); }, [key]);
  return { data, loading, error, reload };
}

// ─── filter bar ─────────────────────────────────────────────────────────────

const MODES: { id: PeriodMode; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

const COMPARE_OPTIONS: { id: CompareMode; label: string }[] = [
  { id: 'previous', label: 'Previous period' },
  { id: 'yoy', label: 'Same period last year' },
  { id: 'none', label: 'No comparison' },
];

const ctlBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 11px',
  background: '#fff', border: '1px solid #d9dee6', borderRadius: 8, fontSize: '0.8rem',
  fontWeight: 650, color: '#202124', cursor: 'pointer', whiteSpace: 'nowrap',
};

/** Closes on outside click and Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

const panel: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', zIndex: 50, background: '#fff',
  border: '1px solid #e2e7ee', borderRadius: 10, boxShadow: '0 12px 32px rgba(15,23,42,0.14)', padding: 10,
};

const gridBtn = (active: boolean, disabled = false): React.CSSProperties => ({
  padding: '8px 0', borderRadius: 7, border: '1px solid', fontSize: '0.78rem', fontWeight: active ? 800 : 600,
  borderColor: active ? '#0f172a' : 'transparent', background: active ? '#0f172a' : disabled ? '#fafafa' : '#f8fafc',
  color: active ? '#fff' : disabled ? '#cbd5e1' : '#334155', cursor: 'pointer',
});

/** Click the period label to jump straight to a day / month / quarter / year. */
const PeriodPicker = () => {
  const p = usePeriod();
  const { open, setOpen, ref } = usePopover();
  const anchorDate = parseISO(p.anchor);
  const [viewYear, setViewYear] = useState(anchorDate.getFullYear());
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));

  useEffect(() => { if (open) setViewYear(parseISO(p.anchor).getFullYear()); }, [open, p.anchor]);

  const yearStepper = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <button type="button" aria-label="Previous year" onClick={() => setViewYear(y => y - 1)} style={{ ...ctlBase, height: 28, padding: '0 6px' }}><ChevronLeft size={14} /></button>
      <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{viewYear}</span>
      <button type="button" aria-label="Next year" onClick={() => setViewYear(y => y + 1)} style={{ ...ctlBase, height: 28, padding: '0 6px' }}><ChevronRight size={14} /></button>
    </div>
  );

  let body: React.ReactNode = null;
  if (p.mode === 'day' || p.mode === 'week') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
          {p.mode === 'day' ? 'Pick a day' : 'Pick any day in the week'}
        </span>
        <input
          type="date"
          value={p.anchor}
          max={today}
          onChange={e => { if (e.target.value) { p.setAnchor(e.target.value); setOpen(false); } }}
          style={{ ...ctlBase, width: '100%', cursor: 'text' }}
        />
      </div>
    );
  } else if (p.mode === 'month') {
    body = (
      <div style={{ width: 230 }}>
        {yearStepper}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
          {MONTHS_SHORT.map((m, i) => {
            const iso = `${viewYear}-${String(i + 1).padStart(2, '0')}-01`;
            const active = p.range.from === iso;
            const future = iso > today;
            return (
              <button key={m} type="button" style={gridBtn(active, future)} onClick={() => { p.setAnchor(iso); setOpen(false); }}>{m}</button>
            );
          })}
        </div>
      </div>
    );
  } else if (p.mode === 'quarter') {
    body = (
      <div style={{ width: 230 }}>
        {yearStepper}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
          {[1, 2, 3, 4].map(q => {
            const iso = `${viewYear}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
            return (
              <button key={q} type="button" style={gridBtn(p.range.from === iso, iso > today)} onClick={() => { p.setAnchor(iso); setOpen(false); }}>Q{q}</button>
            );
          })}
        </div>
      </div>
    );
  } else if (p.mode === 'year') {
    const years: number[] = [];
    for (let y = thisYear; y >= Number(DATA_START.slice(0, 4)) - 1; y--) years.push(y);
    body = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, width: 200 }}>
        {years.map(y => (
          <button key={y} type="button" style={gridBtn(p.range.from === `${y}-01-01`)} onClick={() => { p.setAnchor(`${y}-01-01`); setOpen(false); }}>{y}</button>
        ))}
      </div>
    );
  }

  if (p.mode === 'custom') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="date" aria-label="From" value={p.range.from} max={p.range.to}
          onChange={e => e.target.value && p.setCustom({ from: e.target.value, to: p.range.to })}
          style={{ ...ctlBase, cursor: 'text' }} />
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>to</span>
        <input type="date" aria-label="To" value={p.range.to} min={p.range.from}
          onChange={e => e.target.value && p.setCustom({ from: p.range.from, to: e.target.value })}
          style={{ ...ctlBase, cursor: 'text' }} />
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ ...ctlBase, minWidth: 170, justifyContent: 'center', fontWeight: 800 }}>
        <CalendarDays size={14} color="#64748b" />
        {p.label}
      </button>
      {open && <div style={{ ...panel, left: 0 }}>{body}</div>}
    </div>
  );
};

const PresetMenu = () => {
  const p = usePeriod();
  const { open, setOpen, ref } = usePopover();
  const item = (id: string, label: string) => (
    <button key={id} type="button" onClick={() => { p.applyPreset(id); setOpen(false); }}
      className="fin-menu-item"
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: '0.8rem', color: '#202124', cursor: 'pointer' }}>
      {label}
    </button>
  );
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={ctlBase}>
        Quick ranges <ChevronDown size={13} />
      </button>
      {open && (
        <div style={{ ...panel, right: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: 300 }}>
          <div>
            <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', padding: '2px 10px 4px' }}>Calendar</div>
            {PRESETS.filter(x => x.group === 'calendar').map(x => item(x.id, x.label))}
          </div>
          <div>
            <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', padding: '2px 10px 4px' }}>Rolling</div>
            {PRESETS.filter(x => x.group === 'quick').map(x => item(x.id, x.label))}
          </div>
        </div>
      )}
    </div>
  );
};

const CompareMenu = () => {
  const p = usePeriod();
  const { open, setOpen, ref } = usePopover();
  const current = COMPARE_OPTIONS.find(o => o.id === p.compare)!;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={ctlBase}>
        <span style={{ color: '#64748b', fontWeight: 600 }}>Compare</span> {current.label} <ChevronDown size={13} />
      </button>
      {open && (
        <div style={{ ...panel, right: 0, width: 230 }}>
          {COMPARE_OPTIONS.map(o => (
            <button key={o.id} type="button" className="fin-menu-item" onClick={() => { p.setCompare(o.id); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', color: '#202124' }}>
              {o.label}
              {o.id === p.compare && <Check size={14} />}
            </button>
          ))}
          {p.compareRange && (
            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 6, padding: '8px 10px 2px', fontSize: '0.72rem', color: '#64748b' }}>
              Comparing with {periodLabel('custom', p.compareRange)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Sticky filter bar. ← / → step through periods when focus isn't in a field. */
export const PeriodBar = ({ right }: { right?: React.ReactNode }) => {
  const p = usePeriod();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') p.step(-1);
      else if (e.key === 'ArrowRight') p.step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const today = todayISO();
  const nextDisabled = p.range.to >= today && p.mode !== 'custom';

  return (
    <div className="fin-period-bar fin-no-print" style={{
      position: 'sticky', top: 'env(safe-area-inset-top, 0px)', zIndex: 20,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      padding: '10px 12px', marginBottom: 16, background: 'rgba(246,247,249,0.92)',
      backdropFilter: 'blur(8px)', border: '1px solid #e2e7ee', borderRadius: 12,
    }}>
      <div className="segmented-control" role="tablist" aria-label="Period type" style={{ minHeight: 34 }}>
        {MODES.map(m => (
          <button key={m.id} type="button" role="tab" aria-selected={p.mode === m.id}
            className={p.mode === m.id ? 'is-selected' : ''} onClick={() => p.setMode(m.id)}
            style={{ fontSize: '0.78rem', minWidth: 0, padding: '0 11px' }}>
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" aria-label="Previous period" title="Previous (←)" onClick={() => p.step(-1)} style={{ ...ctlBase, padding: '0 8px' }}>
          <ChevronLeft size={15} />
        </button>
        <PeriodPicker />
        <button type="button" aria-label="Next period" title="Next (→)" onClick={() => p.step(1)} disabled={nextDisabled}
          style={{ ...ctlBase, padding: '0 8px', opacity: nextDisabled ? 0.4 : 1, cursor: nextDisabled ? 'default' : 'pointer' }}>
          <ChevronRight size={15} />
        </button>
        {!p.isCurrent && p.mode !== 'custom' && (
          <button type="button" onClick={p.goToday} style={{ ...ctlBase, color: '#2563eb' }}>Today</button>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <PresetMenu />
        <CompareMenu />
        {right}
      </div>
    </div>
  );
};

/** Day / Week / Month… toggle for chart bucket size. */
export const GranularityToggle = () => {
  const p = usePeriod();
  if (p.granularityOptions.length < 2) return null;
  const names: Record<Granularity, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Yearly' };
  return (
    <div className="segmented-control" style={{ minHeight: 30 }}>
      {p.granularityOptions.map(g => (
        <button key={g} type="button" className={p.chartGranularity === g ? 'is-selected' : ''}
          onClick={() => p.setGranularity(g)} style={{ fontSize: '0.72rem', minWidth: 0, padding: '0 9px' }}>
          {names[g]}
        </button>
      ))}
    </div>
  );
};
