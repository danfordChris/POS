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

/** Minor units → display string (TZS has no minor unit; others /100). */
export function formatMoney(minor: number, currency: string): string {
  const zeroDecimal = new Set(['TZS', 'UGX', 'KES', 'RWF', 'JPY']);
  const value = zeroDecimal.has(currency) ? minor : minor / 100;
  return `${currency} ${value.toLocaleString(undefined, {
    maximumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
  })}`;
}
