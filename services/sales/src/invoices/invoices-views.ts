import type { Prisma } from '#prisma';

const invoiceWithChildren = {
  include: { lines: true, payments: true },
} satisfies Prisma.InvoiceDefaultArgs;

export type InvoiceRow = Prisma.InvoiceGetPayload<typeof invoiceWithChildren>;

export interface InvoiceLineView {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price_minor: number;
  discount_minor: number;
  line_total_minor: number;
}

export interface InvoicePaymentView {
  id: string;
  amount_minor: number;
  method: string;
  reference: string | null;
  received_at: string;
}

export interface InvoiceView {
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
  lines: InvoiceLineView[];
  payments: InvoicePaymentView[];
}

export interface InvoiceSummaryView {
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

/** Fixed public whitelist for `GET /v1/i/{token}` — snapshots only, no ids,
 * no cost, no cross-customer fields. */
export interface PublicInvoiceView {
  number: number;
  status: string;
  currency: string;
  issue_date: string;
  due_date: string;
  business_name: string;
  customer_name: string;
  lines: {
    description: string;
    quantity: number;
    unit_price_minor: number;
    discount_minor: number;
    line_total_minor: number;
  }[];
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  balance_due_minor: number;
}

export function toInvoiceView(inv: InvoiceRow): InvoiceView {
  return {
    id: inv.id,
    number: inv.number,
    sale_id: inv.saleId,
    customer_id: inv.customerId,
    customer_name: inv.customerNameSnapshot,
    status: inv.status,
    currency: inv.currency,
    subtotal_minor: inv.subtotalMinor,
    discount_minor: inv.discountMinor,
    tax_minor: inv.taxMinor,
    total_minor: inv.totalMinor,
    amount_paid_minor: inv.amountPaidMinor,
    balance_due_minor: inv.balanceDueMinor,
    issue_date: inv.issueDate.toISOString(),
    due_date: inv.dueDate.toISOString(),
    public_token: inv.publicToken,
    void_reason: inv.voidReason,
    document_url: inv.documentUrl,
    created_at: inv.createdAt.toISOString(),
    lines: inv.lines.map((l) => ({
      id: l.id,
      product_id: l.productId,
      description: l.description,
      quantity: l.quantity,
      unit_price_minor: l.unitPriceMinor,
      discount_minor: l.discountMinor,
      line_total_minor: l.lineTotalMinor,
    })),
    payments: inv.payments
      .slice()
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
      .map((p) => ({
        id: p.id,
        amount_minor: p.amountMinor,
        method: p.method,
        reference: p.reference,
        received_at: p.receivedAt.toISOString(),
      })),
  };
}

export function toInvoiceSummary(
  inv: Pick<
    InvoiceRow,
    | 'id'
    | 'number'
    | 'customerId'
    | 'customerNameSnapshot'
    | 'status'
    | 'currency'
    | 'totalMinor'
    | 'balanceDueMinor'
    | 'issueDate'
    | 'dueDate'
  >,
): InvoiceSummaryView {
  return {
    id: inv.id,
    number: inv.number,
    customer_id: inv.customerId,
    customer_name: inv.customerNameSnapshot,
    status: inv.status,
    currency: inv.currency,
    total_minor: inv.totalMinor,
    balance_due_minor: inv.balanceDueMinor,
    issue_date: inv.issueDate.toISOString(),
    due_date: inv.dueDate.toISOString(),
  };
}

export function toPublicInvoiceView(inv: InvoiceRow): PublicInvoiceView {
  return {
    number: inv.number,
    status: inv.status,
    currency: inv.currency,
    issue_date: inv.issueDate.toISOString(),
    due_date: inv.dueDate.toISOString(),
    business_name: inv.businessNameSnapshot,
    customer_name: inv.customerNameSnapshot,
    lines: inv.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price_minor: l.unitPriceMinor,
      discount_minor: l.discountMinor,
      line_total_minor: l.lineTotalMinor,
    })),
    subtotal_minor: inv.subtotalMinor,
    discount_minor: inv.discountMinor,
    tax_minor: inv.taxMinor,
    total_minor: inv.totalMinor,
    amount_paid_minor: inv.amountPaidMinor,
    balance_due_minor: inv.balanceDueMinor,
  };
}
