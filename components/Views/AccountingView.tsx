'use client';

import React, { useEffect, useState } from 'react';
import { Panel } from '@/components/Common/Panel';

type Period = 'week' | 'month' | 'year';

type LedgerEntry = {
  date: string;
  account: string;
  memo: string;
  debit: number;
  credit: number;
};

type ReconItem = {
  label: string;
  amount: number;
  sub: string;
  color: string;
};

type AccountingData = {
  label: string;
  revenueMTD: number;
  orderCount: number;
  collected: number;
  codPending: number;
  pathaoInProcess: number;
  pathaoInReview: number;
  pathaoPreparingInvoice: number;
  lifetimeEarning: number;
  ledgerEntries: LedgerEntry[];
  reconciliation: ReconItem[];
  isMock: boolean;
};

const fmt = (n: number) => `BDT ${n.toLocaleString()}`;

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Last 7 Days',
  month: 'This Month',
  year: 'This Year',
};

function KpiCard({
  label, value, sub, color, loading,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  readonly color: string;
  readonly loading: boolean;
}) {
  return (
    <div className="metric-card" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: '0.7rem', color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#202124', marginBottom: 4 }}>
        {loading ? '—' : value}
      </div>
      <div style={{ fontSize: '0.72rem', color: '#999' }}>{sub}</div>
    </div>
  );
}

export const AccountingView: React.FC = () => {
  const [data, setData] = useState<AccountingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/accounting?period=${period}`)
      .then((r) => r.json())
      .then((json) => setData(json as AccountingData))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [period]);

  const kpis = [
    { label: 'Revenue', value: fmt(data?.revenueMTD ?? 0), sub: `${data?.orderCount ?? 0} orders`, color: '#2563eb' },
    { label: 'COD Collected', value: fmt(data?.collected ?? 0), sub: 'Settled & paid by Pathao', color: '#16864d' },
    { label: 'COD Pending', value: fmt(data?.codPending ?? 0), sub: 'In review / processing', color: '#b46a08' },
    { label: 'Lifetime COD Earning', value: fmt(data?.lifetimeEarning ?? 0), sub: 'All-time via Pathao', color: '#6d4ed9' },
  ];

  return (
    <section className="view" id="accounting-view" data-title="Accounting">
      <div className="module-toolbar" style={{ marginBottom: 20 }}>
        <div className="segmented-control">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              className={period === p ? 'is-selected' : ''}
              onClick={() => setPeriod(p)}
              type="button"
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.82rem', color: '#68707a' }}>
          {isLoading ? 'Loading…' : (data?.label ?? '')}
        </span>
      </div>

      <div className="kpi-grid">
        {kpis.map(({ label, value, sub, color }) => (
          <KpiCard key={label} label={label} value={value} sub={sub} color={color} loading={isLoading} />
        ))}
      </div>

      <div className="content-grid" style={{ marginTop: 24 }}>
        <Panel
          title="Revenue Ledger"
          subtitle="WooCommerce orders as revenue entries (most recent 20)."
          className="wide-panel"
        >
          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Loading…</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Memo</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.ledgerEntries ?? []).map((entry) => (
                    <tr key={`${entry.date}-${entry.account}-${entry.memo}`}>
                      <td>{entry.date}</td>
                      <td>{entry.account}</td>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.memo}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {entry.debit > 0 ? fmt(entry.debit) : '—'}
                      </td>
                    </tr>
                  ))}
                  {(data?.ledgerEntries ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#999', padding: '1.5rem' }}>
                        No entries for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Pathao COD Reconciliation" subtitle="Live settlement amounts from Pathao.">
          {isLoading ? (
            <div style={{ padding: '1rem', color: '#999' }}>Loading…</div>
          ) : (
            <div style={{ padding: '1rem' }}>
              {(data?.reconciliation ?? []).map((item, i, arr) => (
                <div
                  key={item.label}
                  style={{
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: i < arr.length - 1 ? '1px solid #e0e0e0' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.875rem', color: item.color }}>{item.label}</strong>
                    <span style={{ fontWeight: 700 }}>{fmt(item.amount)}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#68707a', marginTop: 4 }}>{item.sub}</div>
                </div>
              ))}
              {(data?.reconciliation ?? []).length === 0 && (
                <div style={{ color: '#999', fontSize: '0.875rem' }}>No reconciliation data.</div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
};
