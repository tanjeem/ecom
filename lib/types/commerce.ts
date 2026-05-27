export type OrderStatus = "paid" | "packed" | "hold" | "returned";

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
  city: string;
  margin: string;
  notes: string;
  dateCreated?: string;
};

export type InboxOrderInput = {
  name: string;
  phone: string;
  address: string;
  product: string;
  price: number;
  productId?: number;
  variationId?: number;
  quantity?: number;
  city?: string;
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
