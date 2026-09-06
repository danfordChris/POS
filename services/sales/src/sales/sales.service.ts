import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '#prisma';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { uuidv7 } from 'uuidv7';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryClient } from '../rpc/inventory-client.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { publicToken } from './public-token.js';
import { SaleView, toSaleView } from './sales-views.js';

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
      throw new UnprocessableEntityException({
        code: 'insufficient_stock',
        message: 'Not enough stock for one or more items.',
        details: reserve.shortfalls.map((s) => ({
          field: 'lines',
          issue: `${s.product_id} short: available ${s.available}`,
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
