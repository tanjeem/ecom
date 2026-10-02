'use client';

import React, { useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, X, ArrowRight, BellRing } from 'lucide-react';
import { useApi } from './useApi';

export type Alert = { id: string; severity: 'critical' | 'warning' | 'info'; title: string; detail: string; tab?: string };

const KEY = 'finance.alerts.dismissed.v1';
const SNOOZE_MS = 7 * 86_400_000; // a dismissed alert comes back after a week if it still applies

const STYLE = {
  critical: { icon: AlertOctagon, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  warning: { icon: AlertTriangle, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  info: { icon: Info, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
};

const readDismissed = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};

/** Alerts not dismissed in the last week. Shared by the panel and the tab badge. */
export function useAlerts() {
  const { data, loading } = useApi<{ alerts: Alert[] }>('/api/finance/alerts');
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  useEffect(() => setDismissed(readDismissed()), []);
  const dismiss = (id: string) => {
    const next = { ...readDismissed(), [id]: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    setDismissed(next);
  };
  const active = (data?.alerts || []).filter(a => !(dismissed[a.id] && Date.now() - dismissed[a.id] < SNOOZE_MS));
  return { alerts: active, loading, dismiss };
}

export const AlertsPanel = ({ onOpenTab }: { onOpenTab?: (t: string) => void }) => {
  const { alerts, dismiss } = useAlerts();
  const [expanded, setExpanded] = useState(false);
  if (!alerts.length) return null;
  const shown = expanded ? alerts : alerts.slice(0, 3);

  return (
    <div role="region" aria-label="Alerts" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <BellRing size={13} /> Needs attention ({alerts.length})
      </div>
      {shown.map(a => {
        const st = STYLE[a.severity];
        const Icon = st.icon;
        return (
          <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', background: st.bg, border: `1px solid ${st.border}`, borderRadius: 10 }}>
            <Icon size={16} color={st.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', lineHeight: 1.45 }}>
              <b style={{ color: '#0f172a' }}>{a.title}</b>
              <span style={{ color: '#475569' }}> — {a.detail}</span>
              {a.tab && onOpenTab && (
                <button type="button" onClick={() => onOpenTab(a.tab!)} style={{ marginLeft: 6, border: 'none', background: 'none', color: st.color, fontWeight: 800, cursor: 'pointer', fontSize: '0.76rem', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  View <ArrowRight size={11} />
                </button>
              )}
            </div>
            <button type="button" onClick={() => dismiss(a.id)} aria-label="Dismiss for a week" title="Dismiss for a week"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'inline-flex' }}><X size={14} /></button>
          </div>
        );
      })}
      {alerts.length > 3 && (
        <button type="button" onClick={() => setExpanded(e => !e)} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer', padding: 0 }}>
          {expanded ? 'Show fewer' : `Show ${alerts.length - 3} more`}
        </button>
      )}
    </div>
  );
};
