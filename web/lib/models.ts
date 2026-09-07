// Shapes returned by the catalog + inventory services (see their *-view.ts).

export interface Product {
  id: string;
  business_id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit: string;
  image_url: string | null;
  sell_price: number;
  winger_price: number | null;
  currency: string;
  reorder_threshold: number;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Owner only. */
  cost_price?: number;
}

export interface Page<T> {
  data: T[];
  next_cursor: string | null;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  createdAt: string;
}

export interface StockItem {
  product_id: string;
  on_hand: number;
  reorder_threshold: number;
  product_active: boolean;
  low_stock: boolean;
  updated_at: string;
}

export interface AlertConfig {
  /** User-ids or email addresses. Empty ⇒ all active Owners. */
  recipients: string[];
  min_interval_hours: number;
  updated_at: string;
}

export interface SaleLine {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  discount: number;
  line_total: number;
}

export interface SaleSummary {
  id: string;
  number: number;
  status: 'completed' | 'voided';
  total: number;
  currency: string;
  line_count: number;
  created_at: string;
}

export interface Sale {
  id: string;
  number: number;
  status: 'completed' | 'voided';
  subtotal: number;
  discount_total: number;
  total: number;
  currency: string;
  customer_label: string | null;
  created_at: string;
  voided_at: string | null;
  lines: SaleLine[];
  receipt: { public_token: string; status: string } | null;
  invoice: {
    id: string;
    number: number;
    status: string;
    public_token: string;
    balance_due_minor: number;
  } | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  outstanding_balance: number;
  disabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerInvoiceSummary {
  id: string;
  number: number;
  status: string;
  total_minor: number;
  balance_due_minor: number;
  issue_date: string;
  due_date: string;
}

export interface CustomerDetail extends Customer {
  recent_invoices: CustomerInvoiceSummary[];
}

export interface InvoiceSummary {
  id: string;
  number: number;
  customer_id: string;
  customer_name: string;
  status: string;
  currency: string;
  total_minor: number;
  balance_due_minor: number;
  issue_date: string;
  due_date: string;
}

export interface InvoiceLine {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price_minor: number;
  discount_minor: number;
  line_total_minor: number;
}

export interface InvoicePayment {
  id: string;
  amount_minor: number;
  method: string;
  reference: string | null;
  received_at: string;
}

export interface Invoice {
  id: string;
  number: number;
  sale_id: string | null;
  customer_id: string;
  customer_name: string;
  status: string;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  balance_due_minor: number;
  issue_date: string;
  due_date: string;
  public_token: string;
  void_reason: string | null;
  document_url: string | null;
  created_at: string;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: string;
  quantity_delta: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WingerAccount {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  status: 'active' | 'suspended';
  created_at: string;
}

/** Minor units → display string (TZS has no minor unit; others /100). */
export function formatMoney(minor: number, currency: string): string {
  const zeroDecimal = new Set(['TZS', 'UGX', 'KES', 'RWF', 'JPY']);
  const value = zeroDecimal.has(currency) ? minor : minor / 100;
  return `${currency} ${value.toLocaleString(undefined, {
    maximumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
  })}`;
}
