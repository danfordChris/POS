import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '#prisma';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { uuidv7 } from 'uuidv7';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryClient } from '../rpc/inventory-client.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { ListSalesQuery } from './dto/list-sales.dto.js';
import { publicToken } from './public-token.js';
import {
  SaleSummaryView,
  SaleView,
  toSaleSummary,
  toSaleView,
} from './sales-views.js';

type Role = 'owner' | 'staff';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const outbox = new OutboxWriter();

interface ResolvedLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryClient,
  ) {}

  async createSale(
    businessId: string,
    userId: string,
    dto: CreateSaleDto,
    idempotencyKey?: string,
  ): Promise<SaleView> {
    // 1. Idempotency replay.
    if (idempotencyKey) {
      const prior = await this.prisma.runInTenantContext(businessId, (tx) =>
        tx.sale.findUnique({
          where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
          include: { lines: true, receipt: true },
        }),
      );
      if (prior) return toSaleView(prior);
    }

    // 2. Resolve line snapshots from the request or the product cache.
    const { lines, subtotal, discountTotal, total, currency, businessName } =
      await this.resolveLines(businessId, dto);

    // 3. Reserve stock (before the write txn).
    const reservationId = uuidv7();
    const reserve = await this.inventory.reserveStock({
      business_id: businessId,
      reservation_id: reservationId,
      lines: lines.map((l) => ({
        product_id: l.productId,
        quantity: l.quantity,
      })),
    });
    if (!reserve.ok) {
      // Nothing was reserved on a shortfall (inventory.reserveStock creates no
      // reservation), so there is no hold to release here.
      const wanted = new Map(lines.map((l) => [l.productId, l.quantity]));
      throw new UnprocessableEntityException({
        code: 'insufficient_stock',
        message: 'Not enough stock for one or more items.',
        details: reserve.shortfalls.map((s) => ({
          field: 'lines',
          issue: `${s.product_id}: requested ${wanted.get(s.product_id) ?? '?'}, available ${s.available}`,
        })),
      });
    }

    // 4. Write the sale in one tenant transaction.
    let saleId: string;
    try {
      saleId = await this.prisma.runInTenantContext(businessId, async (tx) => {
        const [{ number }] = await tx.$queryRaw<{ number: number }[]>`
          INSERT INTO sale_number_counter (business_id, next_number)
          VALUES (${businessId}::uuid, 2)
          ON CONFLICT (business_id)
            DO UPDATE SET next_number = sale_number_counter.next_number + 1
          RETURNING next_number - 1 AS number`;

        const sale = await tx.sale.create({
          data: {
            businessId,
            number,
            status: 'completed',
            subtotal,
            discountTotal,
            total,
            currency,
            soldBy: userId,
            customerLabel: dto.customer_label ?? null,
            idempotencyKey: idempotencyKey ?? null,
            reservationId,
            lines: {
              create: lines.map((l) => ({
                businessId,
                productId: l.productId,
                nameSnapshot: l.name,
                unitPriceSnapshot: l.unitPrice,
                quantity: l.quantity,
                discount: l.discount,
                lineTotal: l.lineTotal,
              })),
            },
          },
        });

        await tx.receipt.create({
          data: {
            businessId,
            saleId: sale.id,
            publicToken: publicToken(),
            businessNameSnapshot: businessName,
            currency,
            status: 'issued',
          },
        });

        await outbox.write(tx, {
          subject: SUBJECTS.sales.saleCompleted,
          payload: makeEnvelope({
            producer: 'sales',
            businessId,
            schemaVersion: SCHEMA_VERSION,
            payload: {
              business_id: businessId,
              sale_id: sale.id,
              reservation_id: reservationId,
              lines: lines.map((l) => ({
                product_id: l.productId,
                quantity: l.quantity,
              })),
              total,
              currency,
            },
          }),
        });
        return sale.id;
      });
    } catch (error) {
      // Lost an idempotency-key race — release our hold, return the winner.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        idempotencyKey
      ) {
        await this.safeRelease(businessId, reservationId);
        const winner = await this.prisma.runInTenantContext(businessId, (tx) =>
          tx.sale.findUniqueOrThrow({
            where: {
              businessId_idempotencyKey: { businessId, idempotencyKey },
            },
            include: { lines: true, receipt: true },
          }),
        );
        return toSaleView(winner);
      }
      await this.safeRelease(businessId, reservationId);
      throw error;
    }

    // 5. Commit the reservation. The SaleCompleted event is the backstop.
    try {
      await this.inventory.commitReservation({
        business_id: businessId,
        reservation_id: reservationId,
        sale_id: saleId,
      });
    } catch (error) {
      this.logger.warn(
        `commitReservation failed for sale ${saleId}; SaleCompleted will backstop: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const full = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { lines: true, receipt: true },
      }),
    );
    return toSaleView(full);
  }

  /** List sales for the business. Staff see only sales they rang up; Owner sees
   * all. Newest-first, cursor-paginated on the (time-ordered) `id`. */
  async listSales(
    businessId: string,
    role: Role,
    userId: string,
    q: ListSalesQuery,
  ): Promise<{ data: SaleSummaryView[]; next_cursor: string | null }> {
    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const where: Record<string, unknown> = {};
      if (role === 'staff') where.soldBy = userId;
      if (q.status) where.status = q.status;
      if (q.cursor) where.id = { lt: q.cursor };
      const rows = await tx.sale.findMany({
        where,
        include: { lines: { select: { id: true } } },
        orderBy: { id: 'desc' },
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      const next = rows.length > limit ? page[page.length - 1].id : null;
      return { data: page.map(toSaleSummary), next_cursor: next };
    });
  }

  /** One sale in full. Staff may only read their own — another user's sale in
   * the same business is `404` (not `403`), to avoid leaking existence. */
  async getSale(
    businessId: string,
    role: Role,
    userId: string,
    id: string,
  ): Promise<SaleView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { lines: true, receipt: true },
      });
      if (!sale || (role === 'staff' && sale.soldBy !== userId)) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Sale not found.',
        });
      }
      return toSaleView(sale);
    });
  }

  /** Public, unauthenticated receipt view — looked up by `public_token` only,
   * with no tenant context. Returns `null` for an unknown or voided receipt.
   * The payload is snapshots only: no `business_id` / `sale_id` / `product_id`. */
  async publicReceipt(token: string): Promise<{
    number: number;
    issued_at: string;
    status: string;
    business_name: string;
    currency: string;
    lines: {
      name: string;
      unit_price: number;
      quantity: number;
      discount: number;
      line_total: number;
    }[];
    subtotal: number;
    discount_total: number;
    total: number;
  } | null> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { publicToken: token },
      include: { sale: { include: { lines: true } } },
    });
    if (!receipt || receipt.status === 'void') return null;
    const { sale } = receipt;
    return {
      number: sale.number,
      issued_at: receipt.issuedAt.toISOString(),
      status: receipt.status,
      business_name: receipt.businessNameSnapshot,
      currency: receipt.currency,
      lines: sale.lines.map((l) => ({
        name: l.nameSnapshot,
        unit_price: l.unitPriceSnapshot,
        quantity: l.quantity,
        discount: l.discount,
        line_total: l.lineTotal,
      })),
      subtotal: sale.subtotal,
      discount_total: sale.discountTotal,
      total: sale.total,
    };
  }

  /** Void a completed sale: mark it `voided`, void the receipt, and emit
   * `SaleVoided` so `inventory` writes the reversal movements. Idempotent — a
   * re-void of an already-voided sale returns it unchanged. */
  async voidSale(businessId: string, id: string): Promise<SaleView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { lines: true, receipt: true },
      });
      if (!sale) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Sale not found.',
        });
      }
      if (sale.status === 'voided') return toSaleView(sale);
      if (sale.status !== 'completed') {
        throw new ConflictException({
          code: 'conflict',
          message: `A ${sale.status} sale cannot be voided.`,
        });
      }

      await tx.sale.update({
        where: { id },
        data: { status: 'voided', voidedAt: new Date() },
      });
      await tx.receipt.updateMany({
        where: { saleId: id },
        data: { status: 'void' },
      });
      await outbox.write(tx, {
        subject: SUBJECTS.sales.saleVoided,
        payload: makeEnvelope({
          producer: 'sales',
          businessId,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id: businessId,
            sale_id: id,
            lines: sale.lines.map((l) => ({
              product_id: l.productId,
              quantity: l.quantity,
            })),
          },
        }),
      });

      const voided = await tx.sale.findUniqueOrThrow({
        where: { id },
        include: { lines: true, receipt: true },
      });
      return toSaleView(voided);
    });
  }

  private async resolveLines(
    businessId: string,
    dto: CreateSaleDto,
  ): Promise<{
    lines: ResolvedLine[];
    subtotal: number;
    discountTotal: number;
    total: number;
    currency: string;
    businessName: string;
  }> {
    const ids = [...new Set(dto.lines.map((l) => l.product_id))];
    const cache = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.productCache.findMany({ where: { productId: { in: ids } } }),
    );
    const byId = new Map(cache.map((c) => [c.productId, c]));
    const bizRow = await this.businessRow(businessId);

    let subtotal = 0;
    let discountTotal = 0;
    const lines: ResolvedLine[] = dto.lines.map((l) => {
      const c = byId.get(l.product_id);
      const unitPrice = l.unit_price ?? c?.sellPrice;
      const name = c?.name;
      if (unitPrice === undefined || unitPrice === null || !name) {
        throw new BadRequestException({
          code: 'validation_error',
          message: 'A line has no price or name available.',
          details: [
            {
              field: 'lines',
              issue: `unknown or unpriced product ${l.product_id}`,
            },
          ],
        });
      }
      const discount = l.discount ?? 0;
      const gross = unitPrice * l.quantity;
      const lineTotal = gross - discount;
      if (lineTotal < 0) {
        throw new BadRequestException({
          code: 'validation_error',
          message: 'A line discount exceeds its value.',
          details: [
            { field: 'lines', issue: `discount too large for ${l.product_id}` },
          ],
        });
      }
      subtotal += gross;
      discountTotal += discount;
      return {
        productId: l.product_id,
        name,
        unitPrice,
        quantity: l.quantity,
        discount,
        lineTotal,
      };
    });

    const currency =
      bizRow?.currency ?? cache.find((c) => c.currency)?.currency ?? 'TZS';
    return {
      lines,
      subtotal,
      discountTotal,
      total: subtotal - discountTotal,
      currency,
      businessName: bizRow?.name ?? 'Business',
    };
  }

  private async businessRow(businessId: string) {
    return this.prisma.salesBusiness.findUnique({ where: { businessId } });
  }

  private async safeRelease(
    businessId: string,
    reservationId: string,
  ): Promise<void> {
    try {
      await this.inventory.releaseReservation({
        business_id: businessId,
        reservation_id: reservationId,
      });
    } catch (error) {
      this.logger.error(
        `releaseReservation failed for ${reservationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
