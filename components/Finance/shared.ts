import { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, TRANSFER_CATEGORIES } from '@/lib/types/finance';

export const fmt = (n: number) =>
  `৳${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const fmtFull = (n: number) =>
  `৳${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const getCategoryLabel = (cat: string) => ALL_CATEGORIES[cat] || cat;

export const getCategoryColor = (cat: string): string => {
  const map: Record<string, string> = {
    fabric: '#2563eb',
    accessories: '#7c3aed',
    sewing: '#0891b2',
    packaging_material: '#059669',
    rent: '#dc2626',
    salary: '#ea580c',
    transport: '#d97706',
    ads_meta: '#db2777',
    ads_google: '#4f46e5',
    photoshoot: '#0d9488',
    miscellaneous: '#64748b',
    pathao_payout: '#0891b2',
    sales_prepaid: '#16a34a',
    sales_cod: '#15803d',
    other_income: '#65a30d',
    owner_investment: '#6366f1',
    loan_received: '#8b5cf6',
    owner_withdrawal: '#ef4444',
    loan_repayment: '#f97316',
  };
  return map[cat] || '#94a3b8';
};

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'bKash', 'Nagad', 'Card', 'Cheque'] as const;

export const TYPE_CATEGORIES = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  transfer: TRANSFER_CATEGORIES,
};

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Shared inline styles used across finance components
export const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d9dee6',
  borderRadius: 7,
  padding: '8px 10px',
  background: '#fff',
  color: '#202124',
  outline: 'none',
  fontSize: '0.85rem',
};

export const selectStyle: React.CSSProperties = { ...inputStyle };

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#68707a',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  marginBottom: 4,
};

export const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: '#111',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontWeight: 700,
  fontSize: '0.83rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

export const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: '#fff',
  color: '#202124',
  border: '1px solid #d9dee6',
};

export const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  background: '#fee2e2',
  color: '#b91c1c',
};
