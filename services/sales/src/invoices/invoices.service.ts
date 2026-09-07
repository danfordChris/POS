import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '#prisma';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { publicToken } from '../sales/public-token.js';
import { ListInvoicesQuery } from './dto/list-invoices.dto.js';
import {
  InvoiceSummaryView,
  InvoiceView,
  PublicInvoiceView,
  toInvoiceSummary,
  toInvoiceView,
  toPublicInvoiceView,
} from './invoices-views.js';

type Role = 'owner' | 'staff';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DAY_MS = 86_400_000;

const outbox = new OutboxWriter();

export interface IssueInvoiceLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
}

export interface IssueFromSaleInput {
  businessId: string;
  saleId: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  businessName: string;
  currency: string;
  locale: string;
  lines: IssueInvoiceLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private netDays(): number {
    return this.config.get<number>('INVOICE_NET_DAYS') ?? 14;
  }

  /**
   * Issue an `issued` invoice for a completed credit sale, inside that sale's
   * transaction. Allocates the per-business invoice number under a row lock,
   * writes `invoice` + `invoice_line` snapshots, bumps the customer's cached
   * balance, and enqueues `InvoiceIssued`. Returns the new invoice id.
   */
  async issueFromSale(
    tx: Prisma.TransactionClient,
    input: IssueFromSaleInput,
  ): Promise<string> {
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + this.netDays() * DAY_MS);

    const [{ number }] = await tx.$queryRaw<{ number: number }[]>`
      INSERT INTO invoice_number_counter (business_id, next_number)
      VALUES (${input.businessId}::uuid, 2)
      ON CONFLICT (business_id)
        DO UPDATE SET next_number = invoice_number_counter.next_number + 1
      RETURNING next_number - 1 AS number`;

    const token = publicToken();
    const invoice = await tx.invoice.create({
      data: {
        businessId: input.businessId,
        number,
        saleId: input.saleId,
        customerId: input.customerId,
        status: 'issued',
        currency: input.currency,
        subtotalMinor: input.subtotal,
        discountMinor: input.discountTotal,
        taxMinor: 0,
        totalMinor: input.total,
        amountPaidMinor: 0,
        balanceDueMinor: input.total,
        issueDate,
        dueDate,
        publicToken: token,
        businessNameSnapshot: input.businessName,
        customerNameSnapshot: input.customerName,
        lines: {
          create: input.lines.map((l) => ({
            businessId: input.businessId,
            productId: l.productId,
            description: l.name,
            quantity: l.quantity,
            unitPriceMinor: l.unitPrice,
            discountMinor: l.discount,
            lineTotalMinor: l.lineTotal,
          })),
        },
      },
    });

    await CustomersService.recomputeOutstandingBalance(
      tx,
      input.businessId,
      input.customerId,
    );

    await outbox.write(tx, {
      subject: SUBJECTS.sales.invoiceIssued,
      payload: makeEnvelope({
        producer: 'sales',
        businessId: input.businessId,
        schemaVersion: SCHEMA_VERSION,
        payload: {
          business_id: input.businessId,
          invoice_id: invoice.id,
          sale_id: input.saleId,
          customer_id: input.customerId,
          customer_name: input.customerName,
          ...(input.customerEmail
            ? { customer_email: input.customerEmail }
            : {}),
          number,
          currency: input.currency,
          total_minor: input.total,
          balance_due_minor: input.total,
          issue_date: issueDate.toISOString(),
          due_date: dueDate.toISOString(),
          public_token: token,
          locale: input.locale,
        },
      }),
    });

    return invoice.id;
  }

  async list(
    businessId: string,
    role: Role,
    userId: string,
    q: ListInvoicesQuery,
  ): Promise<{ data: InvoiceSummaryView[]; next_cursor: string | null }> {
    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const where: Prisma.InvoiceWhereInput = {};
      if (role === 'staff') where.sale = { soldBy: userId };
      if (q.status) where.status = q.status;
      if (q.customer_id) where.customerId = q.customer_id;
      if (q.cursor) where.id = { lt: q.cursor };
      if (q.overdue) {
        where.dueDate = { lt: new Date() };
        where.balanceDueMinor = { gt: 0 };
        where.status = { notIn: ['paid', 'void'] };
      }
      const rows = await tx.invoice.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      const next = rows.length > limit ? page[page.length - 1].id : null;
      return { data: page.map(toInvoiceSummary), next_cursor: next };
    });
  }

  /** One invoice in full. Staff may only read an invoice whose linked sale they
   * rang up — another user's invoice in the same business is `404`. */
  async get(
    businessId: string,
    role: Role,
    userId: string,
    id: string,
  ): Promise<InvoiceView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { lines: true, payments: true, sale: true },
      });
      if (!invoice || (role === 'staff' && invoice.sale?.soldBy !== userId)) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Invoice not found.',
        });
      }
      return toInvoiceView(invoice);
    });
  }

  /** Public, unauthenticated invoice view — looked up by `public_token` only,
   * with no tenant context (relaxed-read RLS on `invoice`). `null` for an
   * unknown or `void` invoice. Snapshots only. */
  async publicInvoice(token: string): Promise<PublicInvoiceView | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { publicToken: token },
      include: { lines: true, payments: true },
    });
    if (!invoice || invoice.status === 'void') return null;
    return toPublicInvoiceView(invoice);
  }
}
