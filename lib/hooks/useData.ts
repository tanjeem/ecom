'use client';

import { useEffect, useState } from 'react';
import type { CommerceOrder } from '@/lib/types/commerce';

interface DashboardData {
  todaySales: number;
  openOrders: number;
  grossMargin: number;
  metaROAS: number;
  pipelineStages: { name: string; count: number }[];
  stockAlerts: Array<{
    sku: string;
    product: string;
    current: number;
    reorderPoint: number;
  }>;
  cashAvailable: number;
  cashObligations: number;
  cashSurplus: number;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch orders from API
        const ordersRes = await fetch('/api/orders');
        const ordersData = await ordersRes.json();
        const orders: CommerceOrder[] = ordersData.orders || [];

        // Calculate metrics from orders
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaySalesTotal = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const openOrdersCount = orders.filter((o) => o.status !== 'returned').length;
        const paidOrders = orders.filter((o) => o.status === 'paid').length;
        const packedOrders = orders.filter((o) => o.status === 'packed').length;
        const readyOrders = orders.filter((o) => o.status === 'hold').length;
        const dispatchedOrders = orders.filter((o) => o.pathaoStatus === 'Delivered').length;

        setData({
          todaySales: todaySalesTotal,
          openOrders: openOrdersCount,
          grossMargin: 58.7,
          metaROAS: 4.18,
          pipelineStages: [
            { name: 'Paid', count: paidOrders },
            { name: 'Packed', count: packedOrders },
            { name: 'Ready', count: readyOrders },
            { name: 'Dispatched', count: dispatchedOrders },
          ],
          stockAlerts: [],
          cashAvailable: 96300,
          cashObligations: 37940,
          cashSurplus: 58360,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, isLoading, error };
}

export function useOrdersData() {
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch('/api/orders');
        const data = await response.json();
        setOrders(data.orders || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();
  }, []);

  return { orders, isLoading, error };
}

export function usePathaoStatusUpdates() {
  const [consignments, setConsignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch('/api/pathao/orders');
        const data = await response.json();
        setConsignments(data.consignments || []);
      } catch (error) {
        console.error('Failed to fetch Pathao status:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return { consignments, isLoading };
}

export function useInventoryData() {
  const inventory = {
    items: [
      {
        product: 'Black Linen Shirt',
        sizes: { XS: 8, S: 12, M: 15, L: 10, XL: 6 },
      },
      {
        product: 'White Cotton Robe',
        sizes: { XS: 5, S: 8, M: 12, L: 14, XL: 9 },
      },
      {
        product: 'Navy Chambray Shirt',
        sizes: { XS: 12, S: 14, M: 18, L: 16, XL: 11 },
      },
    ],
    forecasts: [
      {
        product: 'Black Linen Shirt',
        weeklyDemand: 84,
        currentStock: 51,
        percentage: 61,
      },
      {
        product: 'White Cotton Robe',
        weeklyDemand: 62,
        currentStock: 48,
        percentage: 77,
      },
      {
        product: 'Navy Chambray Shirt',
        weeklyDemand: 71,
        currentStock: 71,
        percentage: 100,
      },
    ],
  };

  return inventory;
}

export function useAccountingData() {
  const accounting = {
    revenueMTD: 428900,
    collected: 391240,
    cogs: 176850,
    operatingExpense: 84710,
    netProfit: 167340,
    margin: 39,
    ledgerEntries: [
      {
        date: new Date().toISOString().split('T')[0],
        account: 'Cash',
        memo: 'WooCommerce sales',
        debit: 18420,
        credit: 0,
      },
      {
        date: new Date().toISOString().split('T')[0],
        account: 'Revenue',
        memo: 'WooCommerce sales',
        debit: 0,
        credit: 18420,
      },
    ],
  };

  return accounting;
}

export function useAdsData() {
  const ads = {
    campaigns: [
      {
        name: 'Summer Collection Launch',
        spend: 5240,
        revenue: 21850,
        roas: 4.18,
        cpa: 18.5,
      },
      {
        name: 'Spring Clearance',
        spend: 3120,
        revenue: 9360,
        roas: 3,
        cpa: 22.1,
      },
      {
        name: 'Brand Awareness Test',
        spend: 2100,
        revenue: 4200,
        roas: 2,
        cpa: 42,
      },
    ],
    creatives: [
      {
        name: 'Model lifestyle - Beach',
        impressions: 45200,
        cpm: 0.89,
        status: 'hot',
      },
      {
        name: 'Flat lay - New collection',
        impressions: 32100,
        cpm: 1.05,
        status: 'testing',
      },
      {
        name: 'Product demo - 15s',
        impressions: 18500,
        cpm: 1.34,
        status: 'declining',
      },
    ],
  };

  return ads;
}

export function useScaleOpsData() {
  const scaleOps = {
    processes: [
      {
        name: 'Quality Control',
        description: 'Pack verification before shipment. 342 items packed this week.',
      },
      {
        name: 'Returns Management',
        description: 'Handle returns, refunds, and quality issues. 8 active returns.',
      },
      {
        name: 'Customer Support',
        description: 'Response SLA tracking and escalation. 24 pending inquiries.',
      },
      {
        name: 'Supplier Coordination',
        description: 'PO management and lead time tracking. 3 active orders.',
      },
    ],
    automations: [
      {
        name: 'Auto-dispatch orders',
        description: 'Send packed orders to Pathao daily at 2 PM',
        isActive: true,
      },
      {
        name: 'Stock sync',
        description: 'Sync WooCommerce inventory every hour',
        isActive: true,
      },
      {
        name: 'Low stock alerts',
        description: 'Email when items fall below reorder point',
        isActive: false,
      },
    ],
  };

  return scaleOps;
}
