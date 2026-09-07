import type { RenderedEmail } from './low-stock-vars.js';

export interface InvoiceIssuedVars {
  business_name: string;
  customer_name: string;
  number: number;
  currency: string;
  total_minor: number;
  balance_due_minor: number;
  /** yyyy-mm-dd */
  due_date: string;
  /** Public `/v1/i/{token}` link. */
  invoice_url: string;
}

export interface PaymentReceivedVars {
  business_name: string;
  number: number;
  currency: string;
  amount_minor: number;
  balance_due_minor: number;
  paid_in_full: boolean;
}

export interface OverdueInvoiceLine {
  number: number;
  currency: string;
  balance_due_minor: number;
  due_date: string;
  days_overdue: number;
}

export interface InvoiceOverdueVars {
  business_name: string;
  /** 'customer' → addressed to the buyer; 'owner' → the shop's own summary. */
  audience: 'customer' | 'owner';
  /** Set on the owner summary so each block is labelled. */
  customer_name?: string;
  invoices: OverdueInvoiceLine[];
  total_outstanding_minor: number;
}

export interface InvoiceIssuedTemplate {
  subject(v: InvoiceIssuedVars): string;
  text(v: InvoiceIssuedVars): string;
  html(v: InvoiceIssuedVars): string;
}
export interface PaymentReceivedTemplate {
  subject(v: PaymentReceivedVars): string;
  text(v: PaymentReceivedVars): string;
  html(v: PaymentReceivedVars): string;
}
export interface InvoiceOverdueTemplate {
  subject(v: InvoiceOverdueVars): string;
  text(v: InvoiceOverdueVars): string;
  html(v: InvoiceOverdueVars): string;
}

export const money = (minor: number, currency: string): string =>
  `${currency} ${minor.toLocaleString('en-US')}`;

export type { RenderedEmail };
