'use client';

// Shared building blocks for the Finance tabs, so cards, stat tiles and
// loading/error/empty states look the same everywhere.

import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

const BORDER = '#e2e7ee';
const MUTED = '#94a3b8';
const SURFACE: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

export const Spinner = ({ size = 16 }: { size?: number }) => (
  <RefreshCw size={size} aria-hidden style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
);

/** White panel with an optional header row (title, subtitle, right-aligned action). */
export const Card = ({
  title, subtitle, action, children, padding = '18px 20px', style,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  padding?: number | string;
  style?: React.CSSProperties;
}) => (
  <div style={{ ...SURFACE, padding, ...style }}>
    {(title || action) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          {title && <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>{title}</div>}
          {subtitle && <div style={{ fontSize: '0.72rem', color: MUTED, marginTop: 3 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

/**
 * Label + big number tile. `sub` is the small caption underneath; `badge`
 * sits next to the icon.
 */
export const StatTile = ({
  label, value, sub, color = '#0f172a', icon: Icon, badge,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
  icon?: React.FC<any>;
  badge?: React.ReactNode;
}) => (
  <div style={{ ...SURFACE, borderLeft: `3px solid ${color}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.66rem', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {badge}
        {Icon && <Icon size={14} color={color} />}
      </div>
    </div>
    <div style={{ fontSize: '1.45rem', fontWeight: 900, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: '0.71rem', color: MUTED, lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

export const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

// States. Pass `bare` when rendering inside an existing card/table.

const stateBox = (bare: boolean | undefined, padding: string): React.CSSProperties =>
  bare ? { padding, textAlign: 'center' } : { ...SURFACE, padding, textAlign: 'center' };

export const LoadingState = ({ label = 'Loading…', bare }: { label?: string; bare?: boolean }) => (
  <div style={{ ...stateBox(bare, '3rem'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#64748b', fontSize: '0.85rem' }}>
    <Spinner />
    <span>{label}</span>
  </div>
);

export const ErrorState = ({
  message, hint, onRetry, bare,
}: { message: string; hint?: string; onRetry?: () => void; bare?: boolean }) => (
  <div role="alert" style={stateBox(bare, '2.5rem 2rem')}>
    <AlertCircle size={22} color="#dc2626" style={{ marginBottom: 8 }} />
    <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{message}</p>
    {hint && <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '6px 0 0' }}>{hint}</p>}
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
      >
        <RefreshCw size={12} /> Retry
      </button>
    )}
  </div>
);

export const EmptyState = ({
  icon: Icon, title, hint, bare,
}: { icon?: React.FC<any>; title: string; hint?: string; bare?: boolean }) => (
  <div style={{ ...stateBox(bare, '3rem'), color: MUTED }}>
    {Icon && <Icon size={28} style={{ marginBottom: 10, opacity: 0.45 }} />}
    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{title}</p>
    {hint && <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>{hint}</p>}
  </div>
);

// ─── KPI building blocks ──────────────────────────────────────────────────────

/** Percent change, or null when there's no meaningful base. */
export const pctChange = (current: number, previous: number | null | undefined): number | null => {
  if (previous == null || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

/**
 * Change badge. `goodWhen` says which direction is good, so a cost going up
 * reads red. Arrow + text carry meaning, not colour alone.
 */
export const Delta = ({
  value, goodWhen = 'up', suffix = '%', title, points = false,
}: {
  value: number | null;
  goodWhen?: 'up' | 'down' | 'neutral';
  suffix?: string;
  title?: string;
  /** Show as percentage points (for margins/rates) */
  points?: boolean;
}) => {
  if (value == null || !Number.isFinite(value)) {
    return <span title={title} style={{ fontSize: '0.68rem', color: MUTED, fontWeight: 600 }}>— no base</span>;
  }
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const good = goodWhen === 'neutral' || flat ? null : (up ? goodWhen === 'up' : goodWhen === 'down');
  const color = good == null ? '#64748b' : good ? '#15803d' : '#b91c1c';
  const bg = good == null ? '#f1f5f9' : good ? '#dcfce7' : '#fee2e2';
  const abs = Math.abs(value);
  const txt = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs >= 100 ? abs.toFixed(0) : abs.toFixed(1);
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.68rem', fontWeight: 800, color, background: bg, borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}>
      {flat ? '→' : up ? '▲' : '▼'} {txt}{points ? ' pts' : suffix}
    </span>
  );
};

/** Tiny trend line for KPI tiles. */
export const Sparkline = ({ data, color = '#2a78d6', height = 30 }: { data: number[]; color?: string; height?: number }) => {
  if (data.length < 2) return <div style={{ height }} />;
  const w = 100;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const span = max - min || 1;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${y(v)}`).join(' ');
  const zero = y(0);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      {min < 0 && <line x1={0} x2={w} y1={zero} y2={zero} stroke="#e2e8f0" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      <polyline points={`0,${height} ${pts} ${w},${height}`} fill={color} opacity={0.08} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** Headline metric: value, change vs comparison, caption and sparkline. */
export const KpiCard = ({
  label, value, delta, deltaGoodWhen = 'up', deltaPoints, sub, spark, sparkColor, icon: Icon, tone, onClick, compareValue,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  deltaGoodWhen?: 'up' | 'down' | 'neutral';
  deltaPoints?: boolean;
  sub?: React.ReactNode;
  spark?: number[];
  sparkColor?: string;
  icon?: React.FC<any>;
  tone?: 'good' | 'bad' | 'warn';
  onClick?: () => void;
  compareValue?: string;
}) => {
  const toneColor = tone === 'good' ? '#15803d' : tone === 'bad' ? '#b91c1c' : tone === 'warn' ? '#b45309' : '#0f172a';
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={onClick ? 'fin-kpi fin-kpi-click' : 'fin-kpi'}
      style={{ ...SURFACE, padding: '14px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, cursor: onClick ? 'pointer' : undefined }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {Icon && <Icon size={14} color="#94a3b8" />}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: toneColor, letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 18 }}>
        {delta !== undefined && <Delta value={delta} goodWhen={deltaGoodWhen} points={deltaPoints} title={compareValue ? `Comparison: ${compareValue}` : undefined} />}
        {sub && <span style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.35 }}>{sub}</span>}
      </div>
      {spark && <div style={{ marginTop: 2 }}><Sparkline data={spark} color={sparkColor} /></div>}
    </div>
  );
};

/** Lightweight pill toggle. */
export function Segmented<T extends string>({
  value, options, onChange, size = 'md',
}: { value: T; options: { id: T; label: React.ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="segmented-control" style={{ minHeight: size === 'sm' ? 30 : 34 }}>
      {options.map(o => (
        <button key={o.id} type="button" className={value === o.id ? 'is-selected' : ''} onClick={() => onChange(o.id)}
          style={{ fontSize: size === 'sm' ? '0.72rem' : '0.78rem', minWidth: 0, padding: size === 'sm' ? '0 9px' : '0 12px' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── toasts ────────────────────────────────────────────────────────────────────

export type ToastMsg = { id: number; text: string; tone?: 'ok' | 'error'; action?: { label: string; run: () => void } };

export function useToasts() {
  const [toasts, setToasts] = React.useState<ToastMsg[]>([]);
  const push = React.useCallback((t: Omit<ToastMsg, 'id'>, ms = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(list => [...list, { ...t, id }]);
    setTimeout(() => setToasts(list => list.filter(x => x.id !== id)), ms);
  }, []);
  const dismiss = React.useCallback((id: number) => setToasts(list => list.filter(x => x.id !== id)), []);
  return { toasts, push, dismiss };
}

export const ToastStack = ({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) => (
  <div aria-live="polite" style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'calc(100vw - 40px)' }}>
    {toasts.map(t => (
      <div key={t.id} role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: t.tone === 'error' ? '#7f1d1d' : '#0f172a', color: '#fff', fontSize: '0.82rem', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        <span>{t.text}</span>
        {t.action && (
          <button type="button" onClick={() => { t.action!.run(); dismiss(t.id); }}
            style={{ background: 'none', border: 'none', color: '#93c5fd', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
            {t.action.label}
          </button>
        )}
        <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }}>×</button>
      </div>
    ))}
  </div>
);
