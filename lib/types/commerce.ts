export type OrderStatus = "paid" | "packed" | "hold" | "returned" | "completed";

export type CommerceOrder = {
  id: string;
  wooId: number;
  source: string;
  customer: string;
  phone: string;
  address: string;
  items: string;
  payment: string;
  status: OrderStatus;
  courier: string;
  pathaoStatus: string;
  pathaoConsignment: string;
  payable: number;
  total: number;
  deliveryFee?: number;
  city: string;
  margin: string;
  notes: string;
  dateCreated?: string;
};

export type InboxOrderLineItem = {
  product: string;
  price: number;
  qty: number;
  productId?: number;
  variationId?: number;
};

export type InboxOrderInput = {
  name: string;
  phone: string;
  address: string;
  product: string;
  price: number;
  city?: string;
  productId?: number;
  variationId?: number;
  quantity?: number;
  items?: InboxOrderLineItem[];
  deliveryCharge?: number;
};

export type InventoryItem = {
  sku: string;
  name: string;
  color: string;
  sizes: Record<"XS" | "S" | "M" | "L" | "XL", number>;
  forecast: string;
};

export type ConfigStatus = {
  woocommerce: boolean;
  pathao: boolean;
  pathaoBookingDefaults: boolean;
};
