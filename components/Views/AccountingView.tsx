'use client';

import React from 'react';
import { MetricCard } from '@/components/Common/MetricCard';
import { Panel } from '@/components/Common/Panel';
import { useAccountingData } from '@/lib/hooks/useData';

export const AccountingView: React.FC = () => {
  const accounting = useAccountingData();

  return (
    <section className="view" id="accounting-view" data-title="Accounting">
      <div className="kpi-grid">
        <MetricCard
          label="Revenue MTD"
          value={`$${accounting.revenueMTD.toLocaleString()}`}
          subtitle={`Collected $${accounting.collected.toLocaleString()}`}
          sentiment="positive"
        />
        <MetricCard
          label="COGS"
          value={`$${accounting.cogs.toLocaleString()}`}
          subtitle="Fabric, stitching, packaging"
        />
        <MetricCard
          label="Operating expense"
          value={`$${accounting.operatingExpense.toLocaleString()}`}
          subtitle="Ads, payroll, rent, tools"
        />
        <MetricCard
          label="Net profit"
          value={`$${accounting.netProfit.toLocaleString()}`}
          subtitle={`${accounting.margin}% margin`}
          sentiment="positive"
        />
      </div>

      <div className="content-grid">
        <Panel
          title="General Ledger"
          subtitle="Double-entry accounting with channel reconciliation."
          className="wide-panel"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Memo</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody id="ledger-table">
                {accounting.ledgerEntries.map((entry: any) => (
                  <tr key={`${entry.date}-${entry.account}-${entry.memo}`}>
                    <td>{entry.date}</td>
                    <td>{entry.account}</td>
                    <td>{entry.memo}</td>
                    <td>{entry.debit > 0 ? `$${entry.debit.toLocaleString()}` : '-'}</td>
                    <td>{entry.credit > 0 ? `$${entry.credit.toLocaleString()}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Reconciliation"
          subtitle="Payments, refunds, fees, COD settlements."
        >
          <div className="recon-list" id="recon-list">
            <div style={{ padding: '1rem' }}>
              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e0e0e0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Pathao COD Settlement</strong>
                  <span>$4,320</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  125 orders reconciled
                </div>
              </div>
              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e0e0e0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Meta Ads Spend</strong>
                  <span>$2,145</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  3 campaigns running
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Bank Deposit</strong>
                  <span>$15,200</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  Pending confirmation
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
};
