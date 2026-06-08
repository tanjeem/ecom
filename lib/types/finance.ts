export type TransactionType = 'income' | 'expense' | 'transfer';

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'bKash' | 'Nagad' | 'Card' | 'Cheque';

export const EXPENSE_CATEGORIES: Record<string, string> = {
  fabric: 'Fabric',
  accessories: 'Accessories',
  sewing: 'Sewing / Production',
  packaging_material: 'Packaging Materials',
  rent: 'Rent',
  salary: 'Salary',
  transport: 'Transport',
  ads_meta: 'Meta Ads',
  ads_google: 'Google Ads',
  photoshoot: 'Photoshoot',
  miscellaneous: 'Miscellaneous',
} as const;

export const INCOME_CATEGORIES: Record<string, string> = {
  pathao_payout: 'Pathao COD Payout',
  sales_prepaid: 'Prepaid Sales',
  sales_cod: 'Other COD / Direct',
  other_income: 'Other Income',
} as const;

export const TRANSFER_CATEGORIES: Record<string, string> = {
  owner_investment: 'Owner Investment',
  loan_received: 'Loan Received',
  owner_withdrawal: 'Owner Withdrawal',
  loan_repayment: 'Loan Repayment',
} as const;

export const ALL_CATEGORIES: Record<string, string> = {
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...TRANSFER_CATEGORIES,
};

export const COGS_CATEGORIES = ['fabric', 'accessories', 'sewing', 'packaging_material'];

export const VENDOR_CATEGORIES: Record<string, string> = {
  fabric: 'Fabric Supplier',
  accessories: 'Accessories Supplier',
  packaging: 'Packaging Supplier',
  factory: 'Sewing Factory',
  other: 'Other',
};

export interface FinTransaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  vendor_id?: string;
  vendor_name?: string;
  reference_no?: string;
  notes?: string;
  created_at: string;
}

export interface FinVendor {
  id: string;
  name: string;
  category: string;
  phone?: string;
  bank_details?: string;
  notes?: string;
  is_active?: boolean;
  total_purchased?: number;
  total_paid?: number;
  balance_due?: number;
  created_at: string;
}

export interface FabricPurchase {
  id: string;
  transaction_id?: string;
  vendor_id?: string;
  vendor_name?: string;
  date: string;
  fabric_type: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  notes?: string;
  created_at: string;
}

export interface AccessoryPurchase {
  id: string;
  transaction_id?: string;
  vendor_id?: string;
  vendor_name?: string;
  date: string;
  item: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  total_cost: number;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  created_at: string;
}

export interface ProductionBatch {
  id: string;
  batch_code: string;
  date: string;
  product_type: string;
  target_quantity: number;
  factory?: string;
  estimated_sewing_cost?: number;
  actual_sewing_cost?: number;
  status: string;
  completion_date?: string;
  completed_quantity?: number;
  notes?: string;
  created_at: string;
}

export interface PLData {
  revenue: {
    pathao_payout: number;
    sales_prepaid: number;
    sales_cod: number;
    other_income: number;
    total: number;
  };
  cogs: {
    fabric: number;
    accessories: number;
    sewing: number;
    packaging_material: number;
    total: number;
  };
  opex: {
    rent: number;
    salary: number;
    transport: number;
    ads_meta: number;
    ads_google: number;
    photoshoot: number;
    miscellaneous: number;
    total: number;
  };
  gross_profit: number;
  gross_margin: number;
  net_profit: number;
  net_margin: number;
}
