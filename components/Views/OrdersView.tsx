'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download, Send, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { InboxOrderForm, BulkOrderForm, type InboxOrderData } from '@/components/Orders/InboxOrderForm';
import { OrdersTable } from '@/components/Orders/OrdersTable';
import type { CommerceOrder, OrderStatus } from '@/lib/types/commerce';

type FilterType = 'all' | OrderStatus;

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'paid',      label: 'Processing' },
  { key: 'packed',    label: 'Packed' },
  { key: 'hold',      label: 'Hold' },
  { key: 'completed', label: 'Completed' },
  { key: 'returned',  label: 'Returns' },
];

const STATUS_ACCENT: Record<FilterType, string> = {
  all:       '#6d4ed9',
  paid:      '#2563eb',
  packed:    '#16864d',
  hold:      '#b46a08',
  completed: '#0891b2',
  returned:  '#c23a3a',
};

const PER_PAGE = 50;

function exportCSV(orders: CommerceOrder[]) {
  const headers = ['Order','Date','Customer','Phone','City','Items','Payment','Status','Pathao','Consignment','Payable','Total'];
  const rows = orders.map((o) => [
    o.id,
    (o.dateCreated || '').slice(0, 10),
    `"${o.customer}"`,
    o.phone,
    o.city,
    `"${o.items}"`,
    o.payment,
    o.status,
    o.pathaoStatus,
    o.pathaoConsignment,
    o.payable,
    o.total,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Order detail slide-over ─────────────────────────────────────────────── */

function DetailRow({ label, value }: { readonly label: string; readonly value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9rem', color: '#111827' }}>{value || '—'}</div>
    </div>
  );
}

function bannerBg(state: 'loading' | 'done' | 'error'): string {
  if (state === 'error') return '#fef2f2';
  if (state === 'done')  return '#f0fdf4';
  return '#eff6ff';
}
function bannerColor(state: 'loading' | 'done' | 'error'): string {
  if (state === 'error') return '#b91c1c';
  if (state === 'done')  return '#15803d';
  return '#1d4ed8';
}

function pathaoStatusColor(status: string | undefined): string {
  if (!status || status === 'Not Booked') return '#9ca3af';
  if (status === 'Delivered' || status === 'Partial Delivery') return '#16864d';
  if (['Return', 'Paid Return', 'Returned to Merchant', 'Delivery Failed', 'Pickup Failed'].includes(status)) return '#dc2626';
  return '#2563eb';
}

const STATUS_CHIP: Record<OrderStatus, { bg: string; color: string }> = {
  paid:      { bg: '#dbeafe', color: '#1d4ed8' },
  packed:    { bg: '#d1fae5', color: '#065f46' },
  hold:      { bg: '#fef3c7', color: '#92400e' },
  returned:  { bg: '#fee2e2', color: '#b91c1c' },
  completed: { bg: '#cffafe', color: '#0e7490' },
};

function OrderDetailPanel({
  order,
  onClose,
  onBook,
}: {
  readonly order: CommerceOrder;
  readonly onClose: () => void;
  readonly onBook: (order: CommerceOrder) => void;
}) {
  const sc = STATUS_CHIP[order.status] ?? STATUS_CHIP.paid;
  const displayStatus = order.status === 'paid' ? 'Processing' : order.status.charAt(0).toUpperCase() + order.status.slice(1);
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', border: 'none', cursor: 'default', zIndex: 99 }}
      />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', zIndex: 100,
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111827' }}>{order.id}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
              {order.source} · {(order.dateCreated || '').slice(0, 10) || ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: sc.bg, color: sc.color, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', borderRadius: 4 }}>
              {displayStatus}
            </span>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          {/* Customer */}
          <DetailRow label="Customer" value={order.customer} />
          <DetailRow label="Phone" value={
            <a href={`tel:${order.phone}`} style={{ color: '#2563eb', fontFamily: 'monospace' }}>{order.phone}</a>
          } />
          <DetailRow label="Full Address" value={
            <span style={{ lineHeight: 1.6 }}>
              {[order.address, order.city].filter(Boolean).join(', ')}
            </span>
          } />
          <DetailRow label="Items" value={order.items} />
          <DetailRow label="Payment" value={order.payment} />

          {/* Financials */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>COD Amount</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>৳{(order.payable || 0).toLocaleString()}</div>
            </div>
            {order.deliveryFee != null && order.deliveryFee > 0 && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Delivery Fee</div>
                <div style={{ fontSize: '0.9rem', color: '#374151' }}>৳{order.deliveryFee.toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Special note */}
          {order.notes && order.notes !== 'Synced from WooCommerce.' && (
            <div style={{ marginBottom: 16, padding: '10px 12px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Special Note</div>
              <div style={{ fontSize: '0.85rem', color: '#78350f', lineHeight: 1.5 }}>{order.notes}</div>
            </div>
          )}

          {/* Pathao */}
          <div style={{ borderTop: '1px solid #f0f2f5', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Pathao Courier</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Status</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: pathaoStatusColor(order.pathaoStatus) }}>
                  {order.pathaoStatus || 'Not Booked'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Consignment ID</div>
                <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#374151' }}>{order.pathaoConsignment || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f2f5', display: 'flex', gap: 8 }}>
          {order.pathaoConsignment ? (
            <div style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', color: '#6b7280', padding: '11px', background: '#f9fafb', borderRadius: 8 }}>
              Booked · {order.pathaoConsignment}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { onBook(order); onClose(); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff',
                border: 'none', borderRadius: 8, padding: '11px 16px',
                fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
              }}
            >
              <Send size={15} />
              Book with Pathao
            </button>
          )}
          <a
            href={`https://shingaraproduction.com/wp-admin/post.php?post=${order.wooId}&action=edit`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f3f4f6', color: '#374151', borderRadius: 8, padding: '11px', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
          >
            Edit in WooCommerce ↗
          </a>
        </div>
      </aside>
    </>
  );
}

/* ── New order full page ──────────────────────────────────────────────────── */

function NewOrderPage({ onCreated }: { readonly onCreated: () => void }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  const handleSubmit = async (data: InboxOrderData): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch('/api/orders/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) { onCreated(); return { ok: true }; }
    const json = await res.json() as { error?: string };
    return { ok: false, error: json.error || `Server error ${res.status}` };
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f0f2f6', padding: '22px 28px' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: '#fff', borderRadius: 8, padding: 4, border: '1px solid #e4e8ef', width: 'fit-content' }}>
        {(['single', 'bulk'] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            style={{ padding: '7px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: mode === m ? 700 : 500, background: mode === m ? '#2563eb' : 'transparent', color: mode === m ? '#fff' : '#6b7280', transition: 'all 0.15s' }}>
            {m === 'single' ? 'Single Order' : 'Bulk Create'}
          </button>
        ))}
      </div>

      {/* Form card — full width */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e4e8ef', padding: '28px 32px' }}>
        {mode === 'single'
          ? <InboxOrderForm onSubmit={handleSubmit} />
          : <BulkOrderForm />}
      </div>
    </div>
  );
}

/* ── Main view ───────────────────────────────────────────────────────────── */

export const OrdersView: React.FC = () => {
  const [orders, setOrders]               = useState<CommerceOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [isSyncing, setIsSyncing]         = useState(false);
  const [activeFilter, setActiveFilter]   = useState<FilterType>('all');
  const [detailOrder, setDetailOrder]     = useState<CommerceOrder | null>(null);
  const [viewMode, setViewMode]           = useState<'list' | 'new-order'>('list');
  const [bookingState, setBookingState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [bookingMsg, setBookingMsg]       = useState('');

  // Pagination
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  const fetchOrders = useCallback(async (p = page) => {
    setIsSyncing(true);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: String(PER_PAGE) });
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json() as { orders?: CommerceOrder[]; total?: number; page?: number; totalPages?: number };
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch {
      // silent
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchOrders(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goToPage = (p: number) => {
    setSelectedOrders([]);
    fetchOrders(p);
  };

  /* ── Status change ──────────────────────────────────────────────────────── */
  const handleStatusChange = useCallback(async (order: CommerceOrder, newStatus: OrderStatus) => {
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: newStatus } : o));
    try {
      const res = await fetch(`/api/orders/${order.wooId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: order.status } : o));
      }
    } catch {
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: order.status } : o));
    }
  }, []);

  /* ── Pathao bulk booking ─────────────────────────────────────────────────── */
  const handleBulkSendPathao = useCallback(async () => {
    if (selectedOrders.length === 0) return;
    setBookingState('loading');
    setBookingMsg(`Booking ${selectedOrders.length} order(s) with Pathao…`);
    try {
      const ordersToSend = orders.filter((o) => selectedOrders.includes(o.id));
      const res = await fetch('/api/pathao/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: ordersToSend }),
      });
      const json = await res.json() as { error?: string };
      if (res.ok) {
        setBookingState('done');
        setBookingMsg(`Done — ${selectedOrders.length} order(s) sent to Pathao.`);
        setSelectedOrders([]);
        await fetchOrders(page);
      } else {
        setBookingState('error');
        setBookingMsg(json.error ?? 'Pathao booking failed.');
      }
    } catch (err) {
      setBookingState('error');
      setBookingMsg(err instanceof Error ? err.message : 'Network error.');
    }
  }, [orders, selectedOrders, fetchOrders, page]);

  const handleBookSingle = useCallback(async (order: CommerceOrder) => {
    setBookingState('loading');
    setBookingMsg(`Booking ${order.id} with Pathao…`);
    try {
      const res = await fetch('/api/pathao/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: [order] }),
      });
      const json = await res.json() as { error?: string };
      if (res.ok) {
        setBookingState('done');
        setBookingMsg(`${order.id} booked with Pathao.`);
        await fetchOrders(page);
      } else {
        setBookingState('error');
        setBookingMsg(json.error ?? 'Pathao booking failed.');
      }
    } catch (err) {
      setBookingState('error');
      setBookingMsg(err instanceof Error ? err.message : 'Network error.');
    }
  }, [fetchOrders, page]);

  const filteredOrders = activeFilter === 'all'
    ? orders
    : orders.filter((o) => o.status === activeFilter);

  const getCount = (key: FilterType) =>
    key === 'all' ? orders.length : orders.filter((o) => o.status === key).length;

  const totalPayable = orders
    .filter((o) => selectedOrders.includes(o.id))
    .reduce((s, o) => s + (o.payable || 0), 0);

  return (
    <section className="view is-active" id="orders-view" data-title="Orders" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Top-level view tabs ──────────────────────────────────────────── */}
      <div style={{ background: '#f0f2f6', borderBottom: '1px solid #e4e8ef', padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 8, padding: 4, border: '1px solid #e4e8ef' }}>
        {(['list', 'new-order'] as const).map((key) => {
          const active = viewMode === key;
          return (
            <button key={key} type="button" onClick={() => setViewMode(key)}
              style={{
                flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
                fontSize: '0.88rem', fontWeight: active ? 700 : 500,
                color: active ? '#fff' : '#6b7280',
                background: active ? '#2563eb' : 'transparent',
                borderRadius: 6,
                transition: 'all 0.15s',
              }}>
              {key === 'list' ? 'All Orders' : '+ New Order'}
            </button>
          );
        })}
        </div>
      </div>

      {/* ── New order full page ──────────────────────────────────────────── */}
      {viewMode === 'new-order' && (
        <NewOrderPage onCreated={async () => { setViewMode('list'); await fetchOrders(page); }} />
      )}

      {/* ── Orders list ──────────────────────────────────────────────────── */}
      {viewMode === 'list' && <>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e4e8ef', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 2, flex: 1, flexWrap: 'wrap' }}>
          {FILTERS.map(({ key, label }) => {
            const active = activeFilter === key;
            const accent = STATUS_ACCENT[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: active ? 700 : 500,
                  background: active ? accent + '18' : 'transparent',
                  color: active ? accent : '#6b7280',
                  borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                }}
              >
                {label} <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>({getCount(key)})</span>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fetchOrders(page)}
            disabled={isSyncing}
            title="Sync from WooCommerce"
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', color: '#374151', cursor: 'pointer' }}
          >
            <RefreshCw size={13} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            {isSyncing ? 'Syncing…' : 'Sync'}
          </button>

          <button
            type="button"
            onClick={() => exportCSV(filteredOrders)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', color: '#374151', cursor: 'pointer' }}
          >
            <Download size={13} /> Export
          </button>

          <button
            type="button"
            onClick={handleBulkSendPathao}
            disabled={selectedOrders.length === 0 || bookingState === 'loading'}
            title={selectedOrders.length === 0 ? 'Select orders to book' : `Book ${selectedOrders.length} with Pathao`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#0ea5e9', color: '#fff',
              border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700,
              cursor: selectedOrders.length > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedOrders.length > 0 ? 1 : 0.4,
            }}
          >
            <Send size={13} />
            {selectedOrders.length > 0 ? `Book Pathao (${selectedOrders.length})` : 'Book Pathao'}
          </button>

        </div>
      </div>

      {/* ── Booking status banner ────────────────────────────────────────── */}
      {bookingState !== 'idle' && (
        <div style={{
          padding: '10px 20px', fontSize: '0.82rem', fontWeight: 500,
          background: bannerBg(bookingState),
          color: bannerColor(bookingState),
          borderBottom: '1px solid #e4e8ef', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{bookingMsg}</span>
          <button type="button" onClick={() => setBookingState('idle')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Orders table ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}>
            Loading orders from WooCommerce…
          </div>
        ) : (
          <OrdersTable
            orders={filteredOrders}
            selectedOrders={selectedOrders}
            onSelectionChange={(id, sel) =>
              setSelectedOrders(sel ? [...selectedOrders, id] : selectedOrders.filter((x) => x !== id))
            }
            onSelectAll={(sel) =>
              setSelectedOrders(sel ? filteredOrders.map((o) => o.id) : [])
            }
            onOrderClick={setDetailOrder}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      {/* ── Pagination controls ──────────────────────────────────────────── */}
      {!isLoading && total > 0 && (
        <div style={{
          background: '#fff', borderTop: '1px solid #e4e8ef', padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of <strong>{total.toLocaleString()}</strong> orders
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: 'none', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, fontSize: '0.8rem', color: '#374151' }}
            >
              <ChevronLeft size={14} /> Prev
            </button>

            {/* Page number buttons — show up to 5 around current page */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              return start + i;
            }).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                style={{
                  width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: p === page ? 700 : 400,
                  background: p === page ? '#2563eb' : 'transparent',
                  color: p === page ? '#fff' : '#374151',
                }}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: 'none', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, fontSize: '0.8rem', color: '#374151' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating selection bar ───────────────────────────────────────── */}
      {selectedOrders.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#f8fafc', borderRadius: 10,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '0.875rem' }}>
            <strong>{selectedOrders.length}</strong> selected · BDT {totalPayable.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={handleBulkSendPathao}
            disabled={bookingState === 'loading'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: bookingState === 'loading' ? 'not-allowed' : 'pointer' }}
          >
            <Send size={13} />
            {bookingState === 'loading' ? 'Booking…' : 'Book with Pathao'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedOrders([])}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {detailOrder && (
        <OrderDetailPanel
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onBook={handleBookSingle}
        />
      )}
      </>}

    </section>
  );
};
