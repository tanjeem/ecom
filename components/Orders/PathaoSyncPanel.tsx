'use client';

import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { SyncReport } from '@/lib/orders/pathaoSync';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Result of the last Pathao → WooCommerce sync, with the orders that need a person. */
export const PathaoSyncPanel = ({ report, onDismiss }: { report: SyncReport; onDismiss: () => void }) => {
  const [open, setOpen] = useState(false);
  const s = report.summary;
  const moved = s.dispatched + s.completed + s.cancelled;
  const review = report.pickupCancelled.length + report.possible.length + report.notBooked.length + report.oldReturns.length;
  const failed = report.applied?.failed.length ?? 0;

  const parts = [
    s.dispatched && `${s.dispatched} dispatched`,
    s.completed && `${s.completed} completed`,
    s.cancelled && `${s.cancelled} cancelled (returned)`,
    s.metaOnly && `${s.metaOnly} consignment/status refreshed`,
  ].filter(Boolean);

  return (
    <div role="status" style={{ marginBottom: 12, border: '1px solid #e2e7ee', borderRadius: 10, background: '#fff', fontSize: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', flexWrap: 'wrap' }}>
        {failed ? <AlertTriangle size={15} color="#b45309" /> : <CheckCircle2 size={15} color="#15803d" />}
        <span style={{ color: '#0f172a' }}>
          <b>Synced with Pathao {ago(report.ranAt)}</b>
          <span style={{ color: '#475569' }}> — {parts.length ? parts.join(' · ') : `all ${report.checked} open orders already up to date`}</span>
          {failed > 0 && <span style={{ color: '#b45309' }}> · {failed} couldn’t be saved</span>}
        </span>
        <span style={{ flex: 1 }} />
        {review > 0 && (
          <button type="button" onClick={() => setOpen(o => !o)}
            style={{ border: 'none', background: '#fffbeb', color: '#92400e', borderRadius: 7, padding: '4px 9px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {review} to check {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
        <button type="button" aria-label="Dismiss" onClick={onDismiss} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'inline-flex' }}><X size={14} /></button>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 12px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <Group title="Pickup cancelled by Pathao" hint="Rebook these, or cancel the order."
            rows={report.pickupCancelled.map(r => [`#${r.number}`, r.consignmentId])} />
          <Group title="Possible match — check" hint="Same phone, booked in Pathao without this order number."
            rows={report.possible.map(r => [`#${r.number}`, `${r.consignmentId} · ${r.pathaoStatus}${r.parcelOrderId ? ` · parcel says #${r.parcelOrderId}` : ''}`])} />
          <Group title="Not booked yet" hint="Open 3+ days with no Pathao parcel."
            rows={report.notBooked.map(r => [`#${r.number}`, `${r.status} since ${r.dateCreated}`])} />
          <Group title="Old returns left open" hint="Returned over 60 days ago. Cancelling puts the items back in stock, so do it by hand if stock wasn’t corrected."
            rows={report.oldReturns.map(r => [`#${r.number}`, `${r.consignmentId} · ${r.pathaoStatus} · ${r.dateCreated}`])} />
        </div>
      )}
    </div>
  );
};

const Group = ({ title, hint, rows }: { title: string; hint: string; rows: [string, string][] }) => {
  if (!rows.length) return null;
  return (
    <div>
      <div style={{ fontWeight: 800, color: '#0f172a' }}>{title} <span style={{ color: '#94a3b8', fontWeight: 600 }}>{rows.length}</span></div>
      <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: 6 }}>{hint}</div>
      <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map(([a, b]) => (
          <div key={a + b} style={{ display: 'flex', gap: 8, fontSize: '0.76rem' }}>
            <b style={{ minWidth: 52, color: '#0f172a' }}>{a}</b>
            <span style={{ color: '#475569', fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem' }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
