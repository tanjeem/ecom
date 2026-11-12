'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays } from '@/lib/finance/periods';

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const LABEL = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const fmt = (iso: string) => LABEL.format(new Date(`${iso}T00:00:00`));

/** Monday-first grid of ISO dates for a month (null = padding before the 1st). */
function monthGrid(month: string): (string | null)[] {
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00`).getDay() + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) cells.push(d);
  return cells;
}
const shiftMonth = (month: string, n: number) => {
  const d = new Date(`${month}-01T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Calendar button: click one date to pick that day, click a second date to make a range.
 * Future dates are disabled.
 */
export const DateRangePicker = ({ from, to, max, onChange }: {
  from: string; to: string; max: string; onChange: (from: string, to: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState(to.slice(0, 7));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => {
    if (!open) { setMonth(to.slice(0, 7)); setAnchor(null); }
    setOpen(o => !o);
  };

  const clickDay = (d: string) => {
    if (!anchor) {
      setAnchor(d);
      onChange(d, d); // a single day straight away
    } else {
      const [a, b] = anchor <= d ? [anchor, d] : [d, anchor];
      setAnchor(null);
      onChange(a, b);
      setOpen(false);
    }
  };

  // While picking the second date, preview the range under the mouse
  const [lo, hi] = anchor && hover ? (anchor <= hover ? [anchor, hover] : [hover, anchor]) : [from, to];
  const canNext = shiftMonth(month, 1) <= max.slice(0, 7);

  return (
    <div ref={box} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${open ? '#0f172a' : '#e2e7ee'}`, borderRadius: 10,
          background: '#fff', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
        <CalendarDays size={15} color="#64748b" />
        {from === to ? fmt(from) : `${fmt(from)} → ${fmt(to)}`}
      </button>

      {open && (
        <div role="dialog" aria-label="Pick dates"
          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, width: 292, background: '#fff', border: '1px solid #e2e7ee',
            borderRadius: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.16)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" aria-label="Previous month" onClick={() => setMonth(m => shiftMonth(m, -1))} style={navBtn}><ChevronLeft size={16} /></button>
            <b style={{ fontSize: '0.86rem', color: '#0f172a' }}>{MONTH.format(new Date(`${month}-01T00:00:00`))}</b>
            <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => setMonth(m => shiftMonth(m, 1))} style={{ ...navBtn, opacity: canNext ? 1 : 0.3 }}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }} onMouseLeave={() => setHover(null)}>
            {WEEKDAYS.map(w => <span key={w} style={{ textAlign: 'center', fontSize: '0.66rem', fontWeight: 800, color: '#94a3b8', padding: '4px 0' }}>{w}</span>)}
            {monthGrid(month).map((d, i) => {
              if (!d) return <span key={`p${i}`} />;
              const future = d > max;
              const edge = d === lo || d === hi;
              const inside = d > lo && d < hi;
              return (
                <button key={d} type="button" disabled={future} onClick={() => clickDay(d)} onMouseEnter={() => setHover(d)}
                  aria-pressed={edge || inside}
                  style={{ height: 34, border: 'none', borderRadius: edge ? 8 : 4, cursor: future ? 'default' : 'pointer', fontFamily: 'inherit',
                    fontSize: '0.8rem', fontWeight: edge ? 800 : 600,
                    background: edge ? '#0f172a' : inside ? '#e2e8f0' : 'transparent',
                    color: edge ? '#fff' : future ? '#cbd5e1' : '#0f172a',
                    outline: d === max && !edge ? '1px solid #cbd5e1' : 'none', outlineOffset: -1 }}>
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {anchor ? 'Showing that day. Click another date for a range.' : 'Click a date for one day, or two dates for a range.'}
            </span>
            <button type="button" onClick={() => setOpen(false)}
              style={{ border: 'none', background: '#0f172a', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const navBtn: React.CSSProperties = {
  border: '1px solid #e2e7ee', background: '#fff', borderRadius: 8, width: 30, height: 30, display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#334155',
};
