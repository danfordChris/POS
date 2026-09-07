import type { Customer } from '#prisma';

export interface CustomerView {
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

export interface CustomerDetailView extends CustomerView {
  recent_invoices: CustomerInvoiceSummary[];
}

export function toCustomerView(c: Customer): CustomerView {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    tax_id: c.taxId,
    outstanding_balance: c.outstandingBalance,
    disabled: c.disabledAt !== null,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}
