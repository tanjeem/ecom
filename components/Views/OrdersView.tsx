'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, MessageSquareText, Truck, BadgeDollarSign } from 'lucide-react';
import { Panel } from '@/components/Common/Panel';
import { InboxOrderForm, type InboxOrderData } from '@/components/Orders/InboxOrderForm';
import { DispatchSummary } from '@/components/Orders/DispatchSummary';
import { OrdersTable } from '@/components/Orders/OrdersTable';
import type { CommerceOrder } from '@/lib/types/commerce';

type FilterType = 'all' | 'paid' | 'packed' | 'hold' | 'returned';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'packed', label: 'Packed' },
  { key: 'hold', label: 'Hold' },
  { key: 'returned', label: 'Returns' },
];

export const OrdersView: React.FC = () => {
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState<'draft' | 'pending' | 'success' | 'error'>('draft');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/orders');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCreateInboxOrder = async (formData: InboxOrderData) => {
    setOrderStatus('pending');
    try {
      const response = await fetch('/api/orders/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setOrderStatus('success');
        await fetchOrders();
        setTimeout(() => setOrderStatus('draft'), 2000);
      } else {
        setOrderStatus('error');
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      setOrderStatus('error');
    }
  };

  const handleBulkSendPathao = async () => {
    if (selectedOrders.length === 0) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/pathao/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: selectedOrders }),
      });
      if (response.ok) {
        await fetchOrders();
        setSelectedOrders([]);
      }
    } catch (error) {
      console.error('Failed to send orders to Pathao:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders =
    activeFilter === 'all' ? orders : orders.filter((o) => o.status === activeFilter);

  const totalPayable = orders
    .filter((o) => selectedOrders.includes(o.id))
    .reduce((sum, o) => sum + (o.payable || 0), 0);

  const readyCount = orders.filter((o) => o.status === 'packed').length;

  const getCount = (key: FilterType) =>
    key === 'all' ? orders.length : orders.filter((o) => o.status === key).length;

  const queueTitle = isLoading
    ? 'Orders Queue (loading\u2026)'
    : 'Orders Queue \u2014 ' + String(filteredOrders.length) + ' orders';

  return (
    <section className="view is-active" id="orders-view" data-title="Orders">
      <div className="integration-strip">
        <article className="integration-card">
          <ShoppingBag size={24} />
          <div>
            <span>WooCommerce</span>
            <strong>Live order source</strong>
          </div>
        </article>
        <article className="integration-card">
          <MessageSquareText size={24} />
          <div>
            <span>Inbox orders</span>
            <strong>Paste, verify, create</strong>
          </div>
        </article>
        <article className="integration-card">
          <Truck size={24} />
          <div>
            <span>Pathao delivery</span>
            <strong>Single and bulk booking</strong>
          </div>
        </article>
        <article className="integration-card">
          <BadgeDollarSign size={24} />
          <div>
            <span>Courier payable</span>
            <strong>COD and status sync</strong>
          </div>
        </article>
      </div>

      <div className="content-grid order-tools-grid">
        <Panel
          title="Inbox Order Tool"
          subtitle="Paste a message order, verify the details, then create it in WooCommerce."
          className="panel"
        >
          <InboxOrderForm
            onSubmit={handleCreateInboxOrder}
            isLoading={orderStatus === 'pending'}
            status={orderStatus}
          />
        </Panel>

        <DispatchSummary
          selectedCount={selectedOrders.length}
          readyCount={readyCount}
          totalPayable={totalPayable}
          onSyncWooCommerce={fetchOrders}
          onBulkSendPathao={handleBulkSendPathao}
          isLoading={isLoading}
        />
      </div>

      <div className="module-toolbar">
        <div className="segmented-control" id="order-filter">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={activeFilter === key ? 'is-selected' : ''}
              onClick={() => setActiveFilter(key)}
              type="button"
            >
              {label} ({getCount(key)})
            </button>
          ))}
        </div>
        <div className="toolbar-buttons">
          <button className="secondary-action" onClick={fetchOrders} type="button">
            Sync
          </button>
          <button
            className="secondary-action"
            id="book-pathao-visible"
            onClick={handleBulkSendPathao}
            disabled={selectedOrders.length === 0}
            type="button"
          >
            Book Pathao ({selectedOrders.length})
          </button>
          <button className="primary-action" type="button">
            Export
          </button>
        </div>
      </div>

      <Panel
        title={queueTitle}
        subtitle="Click an order for customer, payment, shipment, and return context."
        className="table-panel"
      >
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            Loading orders from WooCommerce...
          </div>
        ) : (
          <OrdersTable
            orders={filteredOrders}
            selectedOrders={selectedOrders}
            onSelectionChange={(orderId, selected) => {
              setSelectedOrders(
                selected
                  ? [...selectedOrders, orderId]
                  : selectedOrders.filter((id) => id !== orderId),
              );
            }}
            onSelectAll={(selected) => {
              setSelectedOrders(selected ? filteredOrders.map((o) => o.id) : []);
            }}
            onOrderClick={(order) => console.log('Order clicked:', order)}
          />
        )}
      </Panel>
    </section>
  );
};
