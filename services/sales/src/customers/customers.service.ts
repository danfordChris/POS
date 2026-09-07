import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '#prisma';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { ListCustomersQuery } from './dto/list-customers.dto.js';
import {
  CustomerDetailView,
  CustomerView,
  toCustomerView,
} from './customers-views.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const RECENT_INVOICES = 10;

const outbox = new OutboxWriter();

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    businessId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const customer = await tx.customer.create({
        data: {
          businessId,
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim().toLowerCase() || null,
          address: dto.address?.trim() || null,
          taxId: dto.tax_id?.trim() || null,
        },
      });
      await outbox.write(tx, {
        subject: SUBJECTS.sales.customerCreated,
        payload: makeEnvelope({
          producer: 'sales',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            customer_id: customer.id,
            name: customer.name,
            ...(customer.email ? { email: customer.email } : {}),
            ...(customer.phone ? { phone: customer.phone } : {}),
          },
        }),
      });
      return toCustomerView(customer);
    });
  }

  /** Newest-first, cursor-paginated on the time-ordered `id`. Disabled
   * customers are hidden from the default list but stay fetchable by id. */
  async list(
    businessId: string,
    q: ListCustomersQuery,
  ): Promise<{ data: CustomerView[]; next_cursor: string | null }> {
    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const where: Prisma.CustomerWhereInput = { disabledAt: null };
      if (q.has_balance) where.outstandingBalance = { gt: 0 };
      if (q.cursor) where.id = { lt: q.cursor };
      if (q.q?.trim()) {
        const term = q.q.trim();
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ];
      }
      const rows = await tx.customer.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      const next = rows.length > limit ? page[page.length - 1].id : null;
      return { data: page.map(toCustomerView), next_cursor: next };
    });
  }

  async get(businessId: string, id: string): Promise<CustomerDetailView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } });
      if (!customer) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Customer not found.',
        });
      }
      const invoices = await tx.invoice.findMany({
        where: { customerId: id },
        orderBy: { id: 'desc' },
        take: RECENT_INVOICES,
      });
      return {
        ...toCustomerView(customer),
        recent_invoices: invoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          total_minor: inv.totalMinor,
          balance_due_minor: inv.balanceDueMinor,
          issue_date: inv.issueDate.toISOString(),
          due_date: inv.dueDate.toISOString(),
        })),
      };
    });
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const existing = await tx.customer.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Customer not found.',
        });
      }

      const data: Prisma.CustomerUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name.trim();
      if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
      if (dto.email !== undefined) {
        data.email = dto.email?.trim().toLowerCase() || null;
      }
      if (dto.address !== undefined) data.address = dto.address?.trim() || null;
      if (dto.tax_id !== undefined) data.taxId = dto.tax_id?.trim() || null;
      if (dto.disabled !== undefined) {
        data.disabledAt = dto.disabled
          ? (existing.disabledAt ?? new Date())
          : null;
      }

      const customer = await tx.customer.update({ where: { id }, data });
      await outbox.write(tx, {
        subject: SUBJECTS.sales.customerUpdated,
        payload: makeEnvelope({
          producer: 'sales',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            customer_id: customer.id,
            name: customer.name,
            ...(customer.email ? { email: customer.email } : {}),
            ...(customer.phone ? { phone: customer.phone } : {}),
            disabled: customer.disabledAt !== null,
          },
        }),
      });
      return toCustomerView(customer);
    });
  }

  /**
   * Recompute + cache `customer.outstanding_balance` from the invoice ledger —
   * `sum(balance_due_minor)` over the customer's non-void invoices. Runs inside
   * the caller's tenant transaction. Invoice/payment writes (T-0603 / T-0604)
   * call this after every change. Returns the new balance.
   */
  static async recomputeOutstandingBalance(
    tx: Prisma.TransactionClient,
    businessId: string,
    customerId: string,
  ): Promise<number> {
    const agg = await tx.invoice.aggregate({
      _sum: { balanceDueMinor: true },
      where: { businessId, customerId, status: { not: 'void' } },
    });
    const balance = agg._sum.balanceDueMinor ?? 0;
    await tx.customer.update({
      where: { id: customerId },
      data: { outstandingBalance: balance },
    });
    return balance;
  }
}
