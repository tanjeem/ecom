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

type ViewType = 'dashboard' | 'orders' | 'inventory' | 'accounting' | 'ads' | 'scale';

const viewTitles: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  inventory: 'Inventory',
  accounting: 'Accounting',
  ads: 'Meta Ads',
  scale: 'Scale Ops',
};

const viewComponents: Record<ViewType, React.ComponentType> = {
  dashboard: DashboardView,
  orders: OrdersView,
  inventory: InventoryView,
  accounting: AccountingView,
  ads: AdsView,
  scale: ScaleOpsView,
};

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const CurrentView = viewComponents[activeView];

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={(view) => setActiveView(view as ViewType)} />

      <main className="workspace">
        <Topbar
          title={viewTitles[activeView]}
          onSearch={setSearchQuery}
        />

        <CurrentView />
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
