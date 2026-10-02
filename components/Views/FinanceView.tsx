'use client';

import React, { useEffect, useState } from 'react';
import { LayoutDashboard, ArrowLeftRight, Package, Building2, BarChart2, Repeat2, Megaphone, Shirt, RotateCcw, Settings, Wallet, Users, FileText, ChevronDown } from 'lucide-react';
import { FinanceOverview } from '@/components/Finance/FinanceOverview';
import { FinanceTransactions } from '@/components/Finance/FinanceTransactions';
import { FinanceProcurement } from '@/components/Finance/FinanceProcurement';
import { FinanceVendors } from '@/components/Finance/FinanceVendors';
import { FinanceReports } from '@/components/Finance/FinanceReports';
import { FinanceFixedCosts } from '@/components/Finance/FinanceFixedCosts';
import { FinanceAds } from '@/components/Finance/FinanceAds';
import { FinanceProducts } from '@/components/Finance/FinanceProducts';
import { FinanceReturns } from '@/components/Finance/FinanceReturns';
import { FinanceSettings } from '@/components/Finance/FinanceSettings';
import { FinanceCash } from '@/components/Finance/FinanceCash';
import { FinanceCustomers } from '@/components/Finance/FinanceCustomers';
import { useAlerts } from '@/components/Finance/AlertsPanel';
import { PeriodProvider, PeriodBar } from '@/components/Finance/period';

type Tab = 'overview' | 'cash' | 'transactions' | 'procurement' | 'vendors' | 'reports' | 'products' | 'customers' | 'returns' | 'fixed-costs' | 'ads' | 'settings';

const TABS: { id: Tab; label: string; icon: React.FC<any>; more?: boolean }[] = [
  { id: 'overview',      label: 'Overview',      icon: LayoutDashboard },
  { id: 'cash',          label: 'Cash',          icon: Wallet },
  { id: 'transactions',  label: 'Transactions',  icon: ArrowLeftRight },
  { id: 'reports',       label: 'P&L Report',    icon: BarChart2 },
  { id: 'products',      label: 'Products & Stock', icon: Shirt },
  { id: 'customers',     label: 'Customers',     icon: Users },
  { id: 'returns',       label: 'Returns',       icon: RotateCcw },
  { id: 'ads',           label: 'Ads',           icon: Megaphone },
  { id: 'fixed-costs',   label: 'Fixed Costs',   icon: Repeat2, more: true },
  { id: 'procurement',   label: 'Procurement',   icon: Package, more: true },
  { id: 'vendors',       label: 'Vendors',       icon: Building2, more: true },
  { id: 'settings',      label: 'Settings',      icon: Settings, more: true },
];

// Tabs driven by the shared period filter
const PERIOD_TABS = new Set<Tab>(['overview', 'transactions', 'reports', 'products', 'customers', 'returns', 'ads', 'procurement']);
const TAB_KEY = 'finance.tab.v1';

const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const FinanceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [moreOpen, setMoreOpen] = useState(false);
  const { alerts } = useAlerts();
  const urgent = alerts.filter(a => a.severity !== 'info').length;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.some(t => t.id === saved)) setActiveTab(saved);
    } catch { /* storage unavailable */ }
  }, []);

  // Close the More menu on any outside click
  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [moreOpen]);

  const open = (tab: string) => {
    if (!TABS.some(t => t.id === tab)) return;
    setActiveTab(tab as Tab);
    setMoreOpen(false);
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* storage unavailable */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PeriodProvider>
      <section className="view" id="finance-view">
        {/* Tab navigation */}
        <div className="fin-no-print" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 14, borderBottom: '1px solid #e2e7ee' }}>
        <div role="tablist" aria-label="Finance sections" className="fin-tabs" style={{ display: 'flex', gap: 0, overflowX: 'auto', flex: 1, minWidth: 0 }}>
          {TABS.filter(t => !t.more).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => open(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 12px',
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
              {id === 'overview' && urgent > 0 && (
                <span aria-label={`${urgent} alerts`} style={{ minWidth: 17, height: 17, borderRadius: 99, background: '#dc2626', color: '#fff', fontSize: '0.64rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{urgent}</span>
              )}
            </button>
          ))}
        </div>
          {(() => {
            const activeMore = TABS.find(t => t.more && t.id === activeTab);
            return (
              <div style={{ position: 'relative', marginBottom: activeMore ? -1 : 0 }}>
                <button type="button" aria-haspopup="menu" aria-expanded={moreOpen}
                  onClick={e => { e.stopPropagation(); setMoreOpen(o => !o); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 12px', background: 'none', border: 'none', borderBottom: activeMore ? '2px solid #111' : '2px solid transparent', color: activeMore ? '#0f172a' : '#64748b', fontWeight: activeMore ? 800 : 500, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {activeMore ? activeMore.label : 'More'} <ChevronDown size={14} />
                </button>
                {moreOpen && (
                  <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 30, background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, boxShadow: '0 12px 30px rgba(15,23,42,0.14)', padding: 5, minWidth: 180 }}>
                    {TABS.filter(t => t.more).map(({ id, label, icon: Icon }) => (
                      <button key={id} role="menuitem" type="button" className="fin-menu-item" onClick={() => open(id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: 'none', borderRadius: 7, background: activeTab === id ? '#f1f5f9' : 'none', color: '#0f172a', fontSize: '0.82rem', fontWeight: activeTab === id ? 800 : 500, cursor: 'pointer', textAlign: 'left' }}>
                        <Icon size={15} color="#64748b" /> {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <a href={`/finance/report?month=${lastMonth()}`} target="_blank" rel="noopener" className="fin-tab-actions"
            title="Printable monthly report — save as PDF for your accountant or partners"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', marginBottom: 6, border: '1px solid #e2e7ee', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none', whiteSpace: 'nowrap', background: '#fff' }}>
            <FileText size={14} /> Report
          </a>
        </div>

        {PERIOD_TABS.has(activeTab) && <PeriodBar />}

        {/* Tab content */}
        {activeTab === 'overview'     && <FinanceOverview onOpenTab={open} />}
        {activeTab === 'cash'         && <FinanceCash onOpenTab={open} />}
        {activeTab === 'customers'    && <FinanceCustomers />}
        {activeTab === 'transactions' && <FinanceTransactions />}
        {activeTab === 'fixed-costs'  && <FinanceFixedCosts />}
        {activeTab === 'procurement'  && <FinanceProcurement />}
        {activeTab === 'vendors'      && <FinanceVendors />}
        {activeTab === 'ads'          && <FinanceAds />}
        {activeTab === 'reports'      && <FinanceReports />}
        {activeTab === 'products'     && <FinanceProducts />}
        {activeTab === 'returns'      && <FinanceReturns />}
        {activeTab === 'settings'     && <FinanceSettings />}
      </section>
    </PeriodProvider>
  );
};
