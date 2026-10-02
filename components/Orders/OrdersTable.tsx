'use client';

import React from 'react';
import type { CommerceOrder, OrderStatus } from '@/lib/types/commerce';
import { ORDER_STATUSES, STATUS_LABEL, STATUS_STYLE } from '@/lib/orderStatus';

interface OrdersTableProps {
  readonly orders: CommerceOrder[];
  readonly selectedOrders: string[];
  readonly onSelectionChange: (orderId: string, selected: boolean) => void;
  readonly onSelectAll: (selected: boolean) => void;
  readonly onOrderClick: (order: CommerceOrder) => void;
  readonly onStatusChange: (order: CommerceOrder, newStatus: OrderStatus) => void;
}

const PATHAO_COLOR: Record<string, string> = {
  'Delivered':                '#16864d',
  'Partial Delivery':         '#16864d',
  'In Transit':               '#2563eb',
  'Pickup':                   '#2563eb',
  'Assigned for Delivery':    '#2563eb',
  'At the Sorting HUB':       '#2563eb',
  'Received at Last Mile Hub':'#2563eb',
  'Return':                   '#c23a3a',
  'Returned to Merchant':     '#c23a3a',
  'Paid Return':               '#c23a3a',
  'Pickup Failed':            '#c23a3a',
  'Pickup Cancelled':         '#c23a3a',
  'Delivery Failed':          '#c23a3a',
  'On Hold':                  '#c23a3a',
  'Ready':                    '#b46a08',
  'Pickup Requested':         '#b46a08',
  'Not Booked':               '#9ca3af',
};

function pathaoColor(status: string): string {
  return PATHAO_COLOR[status] ?? '#6d4ed9';
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Strip non-digit chars and normalise to 01XXXXXXXXX */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return digits.slice(2);
  if (digits.startsWith('88') && digits.length === 12) return '0' + digits.slice(2);
  return digits;
}

function PhoneCell({ raw }: { readonly raw: string }) {
  const phone = normalisePhone(raw);
  const invalid = phone.length > 0 && phone.length !== 11;
  return (
    <a
      href={`tel:${phone}`}
      onClick={(e) => e.stopPropagation()}
      style={{ color: invalid ? '#dc2626' : '#2563eb', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.8rem' }}
      title={invalid ? `Invalid: ${phone.length} digits (expected 11)` : undefined}
    >
      {phone || '—'}
    </a>
  );
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  selectedOrders,
  onSelectionChange,
  onSelectAll,
  onOrderClick,
  onStatusChange,
}) => {
  const allSelected = orders.length > 0 && selectedOrders.length === orders.length;

  return (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table style={{ minWidth: 1000 }}>
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" aria-label="Select all orders" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} />
            </th>
            <th>Order</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Items</th>
            <th style={{ textAlign: 'right' }}>COD</th>
            <th>Status</th>
            <th>Pathao</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const sc = STATUS_STYLE[order.status] ?? STATUS_STYLE.paid;
            const pc = pathaoColor(order.pathaoStatus || 'Not Booked');
            const isSelected = selectedOrders.includes(order.id);

            return (
              <tr
                key={order.id}
                style={{ background: isSelected ? '#eff6ff' : undefined, cursor: 'pointer' }}
                onClick={() => onOrderClick(order)}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select order ${order.id}`} checked={isSelected} onChange={(e) => onSelectionChange(order.id, e.target.checked)} />
                </td>

                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{order.id}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>{fmtDate(order.dateCreated)}</div>
                </td>
                <td style={{ fontSize: '0.875rem', fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={order.customer}>{order.customer}</td>

                <td onClick={(e) => e.stopPropagation()}>
                  <PhoneCell raw={order.phone || ''} />
                </td>

                <td>
                  <div style={{ fontSize: '0.8rem', color: '#374151', width: 230, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {[order.address, order.city].filter(Boolean).join(', ') || '—'}
                  </div>
                </td>

                <td style={{ fontSize: '0.8rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.items || '—'}
                </td>

                {/* COD (amount to collect) */}
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                  {order.payable ? `৳${order.payable.toLocaleString()}` : '—'}
                </td>

<td onClick={(e) => e.stopPropagation()}>
                  <select
                    value={order.status}
                    onChange={(e) => onStatusChange(order, e.target.value as OrderStatus)}
                    style={{
                      background: sc.bg, color: sc.color,
                      border: 'none', borderRadius: 99,
                      padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700,
                      cursor: 'pointer', outline: 'none',
                    }}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </td>

                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: pc }}>{order.pathaoStatus || 'Not Booked'}</div>
                  {order.pathaoConsignment && (
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>{order.pathaoConsignment}</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {orders.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No orders found.
        </div>
      )}
    </div>
  );
};
