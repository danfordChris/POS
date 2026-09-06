import type { Prisma } from '#prisma';

const saleWithChildren = {
  include: { lines: true, receipt: true },
} satisfies Prisma.SaleDefaultArgs;

export type SaleRow = Prisma.SaleGetPayload<typeof saleWithChildren>;

export interface SaleLineView {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  discount: number;
  line_total: number;
}

export interface SaleView {
  id: string;
  number: number;
  status: string;
  subtotal: number;
  discount_total: number;
  total: number;
  currency: string;
  customer_label: string | null;
  created_at: string;
  voided_at: string | null;
  lines: SaleLineView[];
  receipt: { public_token: string; status: string } | null;
}

export function toSaleView(s: SaleRow): SaleView {
  return {
    id: s.id,
    number: s.number,
    status: s.status,
    subtotal: s.subtotal,
    discount_total: s.discountTotal,
    total: s.total,
    currency: s.currency,
    customer_label: s.customerLabel,
    created_at: s.createdAt.toISOString(),
    voided_at: s.voidedAt?.toISOString() ?? null,
    lines: s.lines.map((l) => ({
      product_id: l.productId,
      name: l.nameSnapshot,
      unit_price: l.unitPriceSnapshot,
      quantity: l.quantity,
      discount: l.discount,
      line_total: l.lineTotal,
    })),
    receipt: s.receipt
      ? { public_token: s.receipt.publicToken, status: s.receipt.status }
      : null,
  };
}
