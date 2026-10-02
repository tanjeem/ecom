// One place for order statuses: labels, colours, and how each maps to
// WooCommerce status slugs (for reading, filtering and writing).

import type { OrderStatus } from '@/lib/types/commerce';

export const ORDER_STATUSES: OrderStatus[] = ['paid', 'packed', 'dispatched', 'hold', 'completed', 'returned'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: 'Processing',
  packed: 'Packed',
  dispatched: 'Dispatched',
  hold: 'On hold',
  completed: 'Completed',
  returned: 'Returned',
};

export const STATUS_STYLE: Record<OrderStatus, { bg: string; color: string; accent: string }> = {
  paid:       { bg: '#dbeafe', color: '#1d4ed8', accent: '#2563eb' },
  packed:     { bg: '#ede9fe', color: '#5b21b6', accent: '#7c3aed' },
  dispatched: { bg: '#e0f2fe', color: '#0369a1', accent: '#0284c7' },
  hold:       { bg: '#fef3c7', color: '#92400e', accent: '#d97706' },
  completed:  { bg: '#dcfce7', color: '#166534', accent: '#16a34a' },
  returned:   { bg: '#fee2e2', color: '#b91c1c', accent: '#dc2626' },
};

/** WooCommerce slugs that count as each status (for server-side filtering and totals). */
export const STATUS_WOO_SLUGS: Record<OrderStatus, string[]> = {
  paid: ['processing', 'pending'],
  packed: ['packed'],
  dispatched: ['dispatched'],
  hold: ['on-hold'],
  completed: ['completed'],
  returned: ['refunded', 'cancelled', 'failed'],
};

/** Slug written to WooCommerce when staff set a status in the app. */
export const STATUS_TO_WOO: Record<OrderStatus, string> = {
  paid: 'processing',
  packed: 'packed',
  dispatched: 'dispatched',
  hold: 'on-hold',
  completed: 'completed',
  returned: 'refunded',
};

export const isOrderStatus = (s: string): s is OrderStatus => (ORDER_STATUSES as string[]).includes(s);
