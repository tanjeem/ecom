'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Download, Send, X, ChevronLeft, ChevronRight, PackageCheck, Truck, CheckCircle2, RotateCcw } from 'lucide-react';
import { InboxOrderForm, BulkOrderForm, type InboxOrderData } from '@/components/Orders/InboxOrderForm';
import { OrdersTable } from '@/components/Orders/OrdersTable';
import type { CommerceOrder, OrderStatus } from '@/lib/types/commerce';
import { ORDER_STATUSES, STATUS_LABEL, STATUS_STYLE } from '@/lib/orderStatus';
import { KpiCard, Segmented, ErrorState } from '@/components/Finance/ui';

type FilterType = 'all' | OrderStatus;

type StatusCounts = Record<FilterType, number>;

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  ...ORDER_STATUSES.map((key) => ({ key, label: STATUS_LABEL[key] })),
];

const PER_PAGE = 50;

// Same 34px control height as the finance period bar
const CTRL: React.CSSProperties = { height: 34, minHeight: 34, padding: '0 12px', fontSize: '0.8rem', borderRadius: 8, gap: 6 };

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

type PathaoStore = { storeId: number; storeName: string; isDefaultStore: boolean };

function OrderDetailPanel({
  order,
  onClose,
  onBook,
  stores,
  selectedStoreId,
  onStoreChange,
}: {
  readonly order: CommerceOrder;
  readonly onClose: () => void;
  readonly onBook: (order: CommerceOrder) => void;
  readonly stores: PathaoStore[];
  readonly selectedStoreId: number | null;
  readonly onStoreChange: (storeId: number) => void;
}) {
  const sc = STATUS_STYLE[order.status] ?? STATUS_STYLE.paid;
  const displayStatus = STATUS_LABEL[order.status] ?? order.status;
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', border: 'none', cursor: 'default', zIndex: 99 }}
      />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(400px, 100vw)',
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stores.length > 1 && (
                <select
                  value={selectedStoreId ?? ''}
                  onChange={(e) => onStoreChange(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: '0.82rem', color: '#374151', background: '#fff',
                  }}
                >
                  {stores.map((s) => (
                    <option key={s.storeId} value={s.storeId}>
                      {s.storeName}{s.isDefaultStore ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => { onBook(order); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '11px 16px',
                  fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
                }}
              >
                <Send size={15} />
                Book with Pathao
              </button>
            </div>
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

function NewOrderPage({ onCreated, onBack }: { readonly onCreated: () => void; readonly onBack: () => void }) {
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
      <button type="button" onClick={onBack}
        style={{ background: 'none', border: 'none', padding: 0, marginBottom: 14, cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600 }}>
        ← Back to orders
      </button>

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

/* ── Loading placeholder ─────────────────────────────────────────────────── */

function OrdersSkeleton() {
  const bar = (w: number | string) => (
    <div style={{ height: 10, width: w, borderRadius: 5, background: 'linear-gradient(90deg,#f1f5f9,#e8edf3,#f1f5f9)', backgroundSize: '200% 100%', animation: 'orders-shimmer 1.2s ease-in-out infinite' }} />
  );
  return (
    <div aria-busy="true" aria-label="Loading orders" style={{ padding: '6px 16px' }}>
      <style>{'@keyframes orders-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }'}</style>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 70px 60px 1.2fr 1fr 2fr 1.4fr 70px 90px', gap: 16, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
          {bar(14)}{bar('80%')}{bar('70%')}{bar('85%')}{bar('75%')}{bar('90%')}{bar('70%')}{bar('80%')}{bar('85%')}
        </div>
      ))}
    </div>
  );
}

/* ── Main view ───────────────────────────────────────────────────────────── */

// Last "New Order" press already acted on. Module-level so remounting the view
// (navigating away and back) doesn't reopen the form for an old press.
let handledNewOrderSignal = 0;

interface OrdersViewProps {
  /** Increments each time the topbar "New Order" button is pressed */
  readonly newOrderSignal?: number;
  /** Text from the topbar search box */
  readonly searchQuery?: string;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ newOrderSignal = 0, searchQuery = '' }) => {
  const [orders, setOrders]               = useState<CommerceOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [isSyncing, setIsSyncing]         = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [counts, setCounts]               = useState<StatusCounts | null>(null);
  const [activeFilter, setActiveFilter]   = useState<FilterType>('all');
  const [detailOrder, setDetailOrder]     = useState<CommerceOrder | null>(null);
  const [viewMode, setViewMode]           = useState<'list' | 'new-order'>(() =>
    newOrderSignal > handledNewOrderSignal ? 'new-order' : 'list');

  useEffect(() => {
    if (newOrderSignal > handledNewOrderSignal) {
      handledNewOrderSignal = newOrderSignal;
      setViewMode('new-order');
    }
  }, [newOrderSignal]);
  const [bookingState, setBookingState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [bookingMsg, setBookingMsg]       = useState('');
  const [pathaoStores, setPathaoStores]   = useState<PathaoStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/pathao/stores')
      .then((r) => r.json())
      .then((json: { stores?: PathaoStore[] }) => {
        const list = json.stores ?? [];
        setPathaoStores(list);
        const def = list.find((s) => s.isDefaultStore) ?? list[0];
        if (def) setSelectedStoreId(def.storeId);
      })
      .catch(() => {});
  }, []);

  // Pagination
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  // Read through refs so callbacks that captured fetchOrders still use the latest search/filter
  const searchRef = useRef(searchQuery.trim());
  const filterRef = useRef<FilterType>('all');

  const fetchOrders = useCallback(async (p = page) => {
    setIsSyncing(true);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: String(PER_PAGE) });
      if (searchRef.current) params.set('search', searchRef.current);
      if (filterRef.current !== 'all') params.set('status', filterRef.current);
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json() as { orders?: CommerceOrder[]; total?: number; page?: number; totalPages?: number; counts?: StatusCounts | null };
      if (!res.ok) throw new Error('WooCommerce did not respond — try Sync again.');
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      if (data.counts) setCounts(data.counts);
      setPage(p);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load orders');
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchOrders(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced server-side search across all orders, not just the current page
  useEffect(() => {
    const q = searchQuery.trim();
    if (q === searchRef.current) return;
    const timer = setTimeout(() => {
      searchRef.current = q;
      setSelectedOrders([]);
      setViewMode('list');
      fetchOrders(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Status tabs filter on the server, across every order — not just the loaded page
  const applyFilter = (f: FilterType) => {
    if (f === filterRef.current) return;
    filterRef.current = f;
    setActiveFilter(f);
    setSelectedOrders([]);
    fetchOrders(1);
  };

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
        body: JSON.stringify({ orders: ordersToSend, storeId: selectedStoreId ?? undefined }),
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
  }, [orders, selectedOrders, fetchOrders, page, selectedStoreId]);

  const handleBookSingle = useCallback(async (order: CommerceOrder) => {
    setBookingState('loading');
    setBookingMsg(`Booking ${order.id} with Pathao…`);
    try {
      const res = await fetch('/api/pathao/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: [order], storeId: selectedStoreId ?? undefined }),
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
  }, [fetchOrders, page, selectedStoreId]);

  const filteredOrders = orders;

  const needDispatch = counts ? counts.paid + counts.packed + counts.hold : null;
  const closed = counts ? counts.completed + counts.returned : 0;
  const returnRate = counts && closed > 0 ? (counts.returned / closed) * 100 : null;

  const totalPayable = orders
    .filter((o) => selectedOrders.includes(o.id))
    .reduce((s, o) => s + (o.payable || 0), 0);

  return (
    <section className="view is-active" id="orders-view" data-title="Orders" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── New order full page ──────────────────────────────────────────── */}
      {viewMode === 'new-order' && (
        <NewOrderPage
          onBack={() => setViewMode('list')}
          onCreated={async () => { setViewMode('list'); await fetchOrders(page); }}
        />
      )}

      {/* ── Orders list ──────────────────────────────────────────────────── */}
      {viewMode === 'list' && <>

      {/* ── Status summary (store-wide, click to filter) ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiCard
          label="Needs dispatch" icon={PackageCheck}
          value={needDispatch == null ? '—' : needDispatch.toLocaleString()}
          tone={needDispatch ? 'warn' : undefined}
          sub={counts ? `${counts.paid} processing · ${counts.packed} packed · ${counts.hold} on hold` : 'Loading…'}
          onClick={() => applyFilter('paid')}
        />
        <KpiCard
          label="Dispatched" icon={Truck}
          value={counts ? counts.dispatched.toLocaleString() : '—'}
          sub="With the courier, not yet completed"
          onClick={() => applyFilter('dispatched')}
        />
        <KpiCard
          label="Completed" icon={CheckCircle2}
          value={counts ? counts.completed.toLocaleString() : '—'}
          sub={counts ? `of ${counts.all.toLocaleString()} orders all-time` : undefined}
          onClick={() => applyFilter('completed')}
        />
        <KpiCard
          label="Returned / cancelled" icon={RotateCcw}
          value={counts ? counts.returned.toLocaleString() : '—'}
          tone={returnRate != null && returnRate >= 25 ? 'bad' : undefined}
          sub={returnRate != null ? `${returnRate.toFixed(1)}% of closed orders` : undefined}
          onClick={() => applyFilter('returned')}
        />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '10px 12px', marginBottom: 12, background: 'rgba(246,247,249,0.92)',
        border: '1px solid #e2e7ee', borderRadius: 12,
      }}>
        {/* Tabs keep their natural width and scroll sideways on narrow screens */}
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <div style={{ width: 'max-content' }}>
          <Segmented
            value={activeFilter}
            onChange={applyFilter}
            options={FILTERS.map(({ key, label }) => ({
              id: key,
              label: (
                <span style={{ whiteSpace: 'nowrap' }}>
                  {label}
                  {counts && <span style={{ marginLeft: 5, fontWeight: 600, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{counts[key].toLocaleString()}</span>}
                </span>
              ),
            }))}
          />
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="secondary-action" style={CTRL} onClick={() => fetchOrders(page)} disabled={isSyncing} title="Reload from WooCommerce">
            <RefreshCw size={13} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            {isSyncing ? 'Syncing…' : 'Sync'}
          </button>

          <button type="button" className="secondary-action" style={CTRL} onClick={() => exportCSV(filteredOrders)} title="Download the orders on this page as CSV">
            <Download size={13} /> Export page
          </button>

          {pathaoStores.length > 1 && (
            <select
              value={selectedStoreId ?? ''}
              onChange={(e) => setSelectedStoreId(Number(e.target.value))}
              title="Pathao store to book orders from"
              style={{ height: 34, border: '1px solid #d9dee6', borderRadius: 8, padding: '0 8px', fontSize: '0.8rem', color: '#374151', background: '#fff' }}
            >
              {pathaoStores.map((s) => (
                <option key={s.storeId} value={s.storeId}>
                  {s.storeName}{s.isDefaultStore ? ' (default)' : ''}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="primary-action"
            onClick={handleBulkSendPathao}
            disabled={selectedOrders.length === 0 || bookingState === 'loading'}
            title={selectedOrders.length === 0 ? 'Select orders to book' : `Book ${selectedOrders.length} with Pathao`}
            style={{ ...CTRL, opacity: selectedOrders.length > 0 ? 1 : 0.45, cursor: selectedOrders.length > 0 ? 'pointer' : 'not-allowed' }}
          >
            <Send size={13} />
            {selectedOrders.length > 0 ? `Book Pathao (${selectedOrders.length})` : 'Book Pathao'}
          </button>
        </div>
      </div>

      {/* ── Booking status banner ────────────────────────────────────────── */}
      {bookingState !== 'idle' && (
        <div role="status" style={{
          padding: '10px 14px', marginBottom: 12, fontSize: '0.82rem', fontWeight: 500, borderRadius: 10,
          background: bannerBg(bookingState), color: bannerColor(bookingState),
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{bookingMsg}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setBookingState('idle')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Orders table ─────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {loadError && orders.length === 0 ? (
          <ErrorState bare message="Could not load orders" hint={loadError} onRetry={() => fetchOrders(page)} />
        ) : isLoading ? (
          <OrdersSkeleton />
        ) : (
          <div style={{ opacity: isSyncing ? 0.55 : 1, transition: 'opacity 150ms ease' }}>
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
          </div>
        )}

        {/* ── Pagination ── */}
        {!isLoading && total > 0 && (
          <div style={{
            borderTop: '1px solid #eef1f5', padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of <strong>{total.toLocaleString()}</strong>
              {activeFilter !== 'all' && <> {STATUS_LABEL[activeFilter].toLowerCase()}</>} orders
              {searchRef.current && <> matching “{searchRef.current}”</>}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" className="secondary-action" onClick={() => goToPage(page - 1)} disabled={page <= 1}
                style={{ ...CTRL, height: 32, minHeight: 32, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
                <ChevronLeft size={14} /> Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                return start + i;
              }).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => goToPage(p)}
                  style={{
                    width: 32, height: 32, border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: p === page ? 800 : 500, fontVariantNumeric: 'tabular-nums',
                    background: p === page ? '#111' : 'transparent',
                    color: p === page ? '#fff' : '#374151',
                  }}
                >
                  {p}
                </button>
              ))}
              <button type="button" className="secondary-action" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                style={{ ...CTRL, height: 32, minHeight: 32, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating selection bar ───────────────────────────────────────── */}
      {selectedOrders.length > 0 && (
        <div style={{
          // Sits above the phone tab bar; on desktop that var is unset and it's 24px up
          position: 'fixed', bottom: 'var(--selection-bar-bottom, 24px)', left: '50%', transform: 'translateX(-50%)',
          maxWidth: 'calc(100vw - 24px)',
          background: '#1e293b', color: '#f8fafc', borderRadius: 10,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '0.875rem' }}>
            <strong>{selectedOrders.length}</strong> selected · ৳{totalPayable.toLocaleString()}
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
          stores={pathaoStores}
          selectedStoreId={selectedStoreId}
          onStoreChange={setSelectedStoreId}
        />
      )}
      </>}

    </section>
  );
};
