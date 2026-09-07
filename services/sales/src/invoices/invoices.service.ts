import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '#prisma';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { publicToken } from '../sales/public-token.js';
import { ListInvoicesQuery } from './dto/list-invoices.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { RecordPaymentDto } from './dto/record-payment.dto.js';
import { VoidInvoiceDto } from './dto/void-invoice.dto.js';
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
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
}

interface IssueCoreInput {
  businessId: string;
  saleId: string | null;
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

export interface IssueFromSaleInput extends Omit<IssueCoreInput, 'saleId'> {
  saleId: string;
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

  /** Allocate the number, write invoice + line snapshots, bump the customer
   * balance, enqueue `InvoiceIssued`. Runs inside the caller's tenant txn. */
  private async issueCore(
    tx: Prisma.TransactionClient,
    input: IssueCoreInput,
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
          ...(input.saleId ? { sale_id: input.saleId } : {}),
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

  async issueFromSale(
    tx: Prisma.TransactionClient,
    input: IssueFromSaleInput,
  ): Promise<string> {
    return this.issueCore(tx, input);
  }

  /** Raise a standalone invoice: explicit `lines`, or snapshot a completed
   * cash sale via `sale_id`. No stock movement. */
  async issueStandalone(
    businessId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceView> {
    const hasLines = Array.isArray(dto.lines) && dto.lines.length > 0;
    if (hasLines === Boolean(dto.sale_id)) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Provide exactly one of `sale_id` or `lines`.',
        details: [{ field: 'lines', issue: 'exactly one of sale_id / lines' }],
      });
    }

    const invoiceId = await this.prisma.runInTenantContext(
      businessId,
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: dto.customer_id },
          select: { id: true, name: true, email: true },
        });
        if (!customer) {
          throw new BadRequestException({
            code: 'validation_error',
            message: 'That customer does not exist.',
            details: [{ field: 'customer_id', issue: 'unknown customer' }],
          });
        }
        const biz = await tx.salesBusiness.findUnique({
          where: { businessId },
        });

        let lines: IssueInvoiceLine[];
        let subtotal: number;
        let discountTotal: number;
        let total: number;
        let saleId: string | null = null;

        if (dto.sale_id) {
          const sale = await tx.sale.findUnique({
            where: { id: dto.sale_id },
            include: { lines: true, invoice: true },
          });
          if (!sale) {
            throw new BadRequestException({
              code: 'validation_error',
              message: 'That sale does not exist.',
              details: [{ field: 'sale_id', issue: 'unknown sale' }],
            });
          }
          if (sale.status !== 'completed') {
            throw new ConflictException({
              code: 'conflict',
              message: `A ${sale.status} sale cannot be invoiced.`,
            });
          }
          if (sale.invoice) {
            throw new ConflictException({
              code: 'conflict',
              message: 'That sale already has an invoice.',
            });
          }
          saleId = sale.id;
          lines = sale.lines.map((l) => ({
            productId: l.productId,
            name: l.nameSnapshot,
            unitPrice: l.unitPriceSnapshot,
            quantity: l.quantity,
            discount: l.discount,
            lineTotal: l.lineTotal,
          }));
          subtotal = sale.subtotal;
          discountTotal = sale.discountTotal;
          total = sale.total;
        } else {
          lines = dto.lines!.map((l) => {
            const discount = l.discount_minor ?? 0;
            const lineTotal = l.unit_price_minor * l.quantity - discount;
            if (lineTotal < 0) {
              throw new BadRequestException({
                code: 'validation_error',
                message: 'A line discount exceeds its value.',
                details: [{ field: 'lines', issue: l.description }],
              });
            }
            return {
              productId: l.product_id ?? null,
              name: l.description,
              unitPrice: l.unit_price_minor,
              quantity: l.quantity,
              discount,
              lineTotal,
            };
          });
          subtotal = lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
          discountTotal = lines.reduce((a, l) => a + l.discount, 0);
          total = subtotal - discountTotal;
        }

        return this.issueCore(tx, {
          businessId,
          saleId,
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          businessName: biz?.name ?? 'Business',
          currency: biz?.currency ?? 'TZS',
          locale: biz?.locale ?? 'en',
          lines,
          subtotal,
          discountTotal,
          total,
        });
      },
    );

    return this.get(businessId, 'owner', '', invoiceId);
  }

  async recordPayment(
    businessId: string,
    invoiceId: string,
    userId: string,
    dto: RecordPaymentDto,
    idempotencyKey?: string,
  ): Promise<InvoiceView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      if (idempotencyKey) {
        const prior = await tx.payment.findFirst({ where: { idempotencyKey } });
        if (prior) return this.loadView(tx, prior.invoiceId);
      }

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { lines: true, payments: true },
      });
      if (!invoice) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Invoice not found.',
        });
      }
      if (invoice.status === 'void' || invoice.status === 'paid') {
        throw new ConflictException({
          code: 'invoice_not_payable',
          message: `A ${invoice.status} invoice cannot take a payment.`,
        });
      }
      if (dto.amount_minor > invoice.balanceDueMinor) {
        throw new UnprocessableEntityException({
          code: 'overpayment',
          message: 'That is more than the balance due.',
          details: [
            {
              field: 'amount_minor',
              issue: `balance due is ${invoice.balanceDueMinor}`,
            },
          ],
        });
      }

      const newPaid = invoice.amountPaidMinor + dto.amount_minor;
      const newBalance = invoice.totalMinor - newPaid;
      const status = newBalance === 0 ? 'paid' : 'partially_paid';

      let payment: { id: string };
      try {
        payment = await tx.payment.create({
          data: {
            businessId,
            invoiceId,
            amountMinor: dto.amount_minor,
            method: dto.method,
            reference: dto.reference ?? null,
            receivedAt: dto.received_at
              ? new Date(dto.received_at)
              : new Date(),
            createdBy: userId,
            idempotencyKey: idempotencyKey ?? null,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          idempotencyKey
        ) {
          return this.loadView(tx, invoiceId);
        }
        throw error;
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaidMinor: newPaid,
          balanceDueMinor: newBalance,
          status,
        },
      });
      await CustomersService.recomputeOutstandingBalance(
        tx,
        businessId,
        invoice.customerId,
      );

      const customer = await tx.customer.findUnique({
        where: { id: invoice.customerId },
        select: { email: true },
      });
      const biz = await tx.salesBusiness.findUnique({ where: { businessId } });

      await outbox.write(tx, {
        subject: SUBJECTS.sales.invoicePaymentRecorded,
        payload: makeEnvelope({
          producer: 'sales',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            invoice_id: invoiceId,
            payment_id: payment.id,
            amount_minor: dto.amount_minor,
            method: dto.method,
            balance_due_minor: newBalance,
            paid_in_full: status === 'paid',
            ...(customer?.email ? { customer_email: customer.email } : {}),
            locale: biz?.locale ?? 'en',
          },
        }),
      });

      return this.loadView(tx, invoiceId);
    });
  }

  /** Void an invoice: `status = void`, zero balance, customer balance drops by
   * the old `balance_due`. Recorded payments are retained. A `paid` invoice
   * cannot be voided. Idempotent for an already-`void` invoice. */
  async voidInvoiceInTx(
    tx: Prisma.TransactionClient,
    businessId: string,
    invoiceId: string,
    reason?: string,
  ): Promise<InvoiceView> {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, payments: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Invoice not found.',
      });
    }
    if (invoice.status === 'void') return toInvoiceView(invoice);
    if (invoice.status === 'paid') {
      throw new ConflictException({
        code: 'invoice_not_payable',
        message: 'A paid invoice cannot be voided.',
      });
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'void',
        balanceDueMinor: 0,
        voidReason: reason ?? null,
      },
    });
    await CustomersService.recomputeOutstandingBalance(
      tx,
      businessId,
      invoice.customerId,
    );
    await outbox.write(tx, {
      subject: SUBJECTS.sales.invoiceVoided,
      payload: makeEnvelope({
        producer: 'sales',
        businessId,
        schemaVersion: SCHEMA_VERSION,
        payload: {
          business_id: businessId,
          invoice_id: invoiceId,
          ...(reason ? { reason } : {}),
        },
      }),
    });
    return this.loadView(tx, invoiceId);
  }

  async voidInvoice(
    businessId: string,
    invoiceId: string,
    dto: VoidInvoiceDto,
  ): Promise<InvoiceView> {
    return this.prisma.runInTenantContext(businessId, (tx) =>
      this.voidInvoiceInTx(tx, businessId, invoiceId, dto.reason),
    );
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

  private async loadView(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ): Promise<InvoiceView> {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lines: true, payments: true },
    });
    return toInvoiceView(invoice);
  }
}
