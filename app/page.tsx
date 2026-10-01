'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Layout/Sidebar';
import { Topbar } from '@/components/Layout/Topbar';
import { Drawer } from '@/components/Layout/Drawer';
import { DashboardView } from '@/components/Views/DashboardView';
import { OrdersView } from '@/components/Views/OrdersView';
import { InventoryView } from '@/components/Views/InventoryView';
import { AccountingView } from '@/components/Views/AccountingView';
import { AdsView } from '@/components/Views/AdsView';
import { ScaleOpsView } from '@/components/Views/ScaleOpsView';
import { FinanceView } from '@/components/Views/FinanceView';

type ViewType = 'dashboard' | 'orders' | 'inventory' | 'accounting' | 'ads' | 'scale' | 'finance';

const viewTitles: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  inventory: 'Inventory',
  accounting: 'Accounting',
  ads: 'Meta Ads',
  scale: 'Scale Ops',
  finance: 'Finance Center',
};

const viewComponents: Record<ViewType, React.ComponentType> = {
  dashboard: DashboardView,
  orders: OrdersView,
  inventory: InventoryView,
  accounting: AccountingView,
  ads: AdsView,
  scale: ScaleOpsView,
  finance: FinanceView,
};

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newOrderSignal, setNewOrderSignal] = useState(0);

  const CurrentView = viewComponents[activeView];

  // Search and "New Order" both live on the Orders view; jump there from anywhere
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) setActiveView('orders');
  };
  const handleNewOrder = () => {
    setActiveView('orders');
    setNewOrderSignal((n) => n + 1);
  };

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={(view) => setActiveView(view as ViewType)} />

      <main className="workspace">
        <Topbar
          title={viewTitles[activeView]}
          searchQuery={searchQuery}
          onSearch={handleSearch}
          onNewOrder={handleNewOrder}
        />

        {activeView === 'orders'
          ? <OrdersView newOrderSignal={newOrderSignal} searchQuery={searchQuery} />
          : <CurrentView />}
      </main>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Order Details"
        content={<div>Order details will appear here</div>}
      />
    </div>
  );
}
