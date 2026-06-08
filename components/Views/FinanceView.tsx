'use client';

import React, { useState } from 'react';
import { LayoutDashboard, ArrowLeftRight, Package, Building2, BarChart2, Repeat2 } from 'lucide-react';
import { FinanceOverview } from '@/components/Finance/FinanceOverview';
import { FinanceTransactions } from '@/components/Finance/FinanceTransactions';
import { FinanceProcurement } from '@/components/Finance/FinanceProcurement';
import { FinanceVendors } from '@/components/Finance/FinanceVendors';
import { FinanceReports } from '@/components/Finance/FinanceReports';
import { FinanceFixedCosts } from '@/components/Finance/FinanceFixedCosts';

type Tab = 'overview' | 'transactions' | 'procurement' | 'vendors' | 'reports' | 'fixed-costs';

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: 'overview',      label: 'Overview',      icon: LayoutDashboard },
  { id: 'transactions',  label: 'Transactions',  icon: ArrowLeftRight },
  { id: 'fixed-costs',   label: 'Fixed Costs',   icon: Repeat2 },
  { id: 'procurement',   label: 'Procurement',   icon: Package },
  { id: 'vendors',       label: 'Vendors',       icon: Building2 },
  { id: 'reports',       label: 'P&L Reports',   icon: BarChart2 },
];

export const FinanceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <section className="view" id="finance-view">
      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e2e7ee', overflowX: 'auto' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === id ? '2px solid #111' : '2px solid transparent',
              color: activeTab === id ? '#0f172a' : '#64748b',
              fontWeight: activeTab === id ? 800 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginBottom: -1,
              transition: 'color 120ms ease, border-color 120ms ease',
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'     && <FinanceOverview />}
      {activeTab === 'transactions' && <FinanceTransactions />}
      {activeTab === 'fixed-costs'  && <FinanceFixedCosts />}
      {activeTab === 'procurement'  && <FinanceProcurement />}
      {activeTab === 'vendors'      && <FinanceVendors />}
      {activeTab === 'reports'      && <FinanceReports />}
    </section>
  );
};
