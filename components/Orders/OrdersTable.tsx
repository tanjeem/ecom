import React from 'react';
import type { CommerceOrder } from '@/lib/types/commerce';

interface OrdersTableProps {
  orders: CommerceOrder[];
  selectedOrders: string[];
  onSelectionChange: (orderId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOrderClick: (order: CommerceOrder) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  selectedOrders,
  onSelectionChange,
  onSelectAll,
  onOrderClick,
}) => {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              <input
                id="select-all-orders"
                type="checkbox"
                aria-label="Select all orders"
                checked={selectedOrders.length === orders.length && orders.length > 0}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th>Order</th>
            <th>Source</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Pathao</th>
            <th>Payable</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody id="orders-table">
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={() => onOrderClick(order)}
              style={{ cursor: 'pointer' }}
            >
              <td>
                <input
                  type="checkbox"
                  checked={selectedOrders.includes(order.id)}
                  onChange={(e) => onSelectionChange(order.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td>{order.id}</td>
              <td>{order.source}</td>
              <td>{order.customer}</td>
              <td>{Array.isArray(order.items) ? order.items.join(', ') : order.items || '-'}</td>
              <td>{order.payment}</td>
              <td>{order.status}</td>
              <td>{order.pathaoStatus || '-'}</td>
              <td>BDT {order.payable?.toLocaleString() || 0}</td>
              <td>BDT {order.total?.toLocaleString() || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
          No orders found
        </div>
      )}
    </div>
  );
};
