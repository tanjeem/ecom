'use client';

import React, { useEffect, useState } from 'react';
import { LayoutDashboard, ArrowLeftRight, Package, Building2, BarChart2, Repeat2, Megaphone } from 'lucide-react';
import { FinanceOverview } from '@/components/Finance/FinanceOverview';
import { FinanceTransactions } from '@/components/Finance/FinanceTransactions';
import { FinanceProcurement } from '@/components/Finance/FinanceProcurement';
import { FinanceVendors } from '@/components/Finance/FinanceVendors';
import { FinanceReports } from '@/components/Finance/FinanceReports';
import { FinanceFixedCosts } from '@/components/Finance/FinanceFixedCosts';
import { FinanceAds } from '@/components/Finance/FinanceAds';
import { PeriodProvider, PeriodBar } from '@/components/Finance/period';

type Tab = 'overview' | 'transactions' | 'procurement' | 'vendors' | 'reports' | 'fixed-costs' | 'ads';

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: 'overview',      label: 'Overview',      icon: LayoutDashboard },
  { id: 'transactions',  label: 'Transactions',  icon: ArrowLeftRight },
  { id: 'reports',       label: 'P&L Report',    icon: BarChart2 },
  { id: 'ads',           label: 'Ads',           icon: Megaphone },
  { id: 'fixed-costs',   label: 'Fixed Costs',   icon: Repeat2 },
  { id: 'procurement',   label: 'Procurement',   icon: Package },
  { id: 'vendors',       label: 'Vendors',       icon: Building2 },
];

// Tabs driven by the shared period filter
const PERIOD_TABS = new Set<Tab>(['overview', 'transactions', 'reports']);
const TAB_KEY = 'finance.tab.v1';

export const FinanceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.some(t => t.id === saved)) setActiveTab(saved);
    } catch { /* storage unavailable */ }
  }, []);

  const open = (tab: string) => {
    if (!TABS.some(t => t.id === tab)) return;
    setActiveTab(tab as Tab);
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* storage unavailable */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PeriodProvider>
      <section className="view" id="finance-view">
        {/* Tab navigation */}
        <div role="tablist" aria-label="Finance sections" className="fin-no-print" style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '1px solid #e2e7ee', overflowX: 'auto' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => open(id)}
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

        {PERIOD_TABS.has(activeTab) && <PeriodBar />}

        {/* Tab content */}
        {activeTab === 'overview'     && <FinanceOverview onOpenTab={open} />}
        {activeTab === 'transactions' && <FinanceTransactions />}
        {activeTab === 'fixed-costs'  && <FinanceFixedCosts />}
        {activeTab === 'procurement'  && <FinanceProcurement />}
        {activeTab === 'vendors'      && <FinanceVendors />}
        {activeTab === 'ads'          && <FinanceAds />}
        {activeTab === 'reports'      && <FinanceReports />}
      </section>
    </PeriodProvider>
  );
};
