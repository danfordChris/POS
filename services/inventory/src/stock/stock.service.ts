import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, StockItem } from '#prisma';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecordMovementDto } from './dto/record-movement.dto.js';
import { ListMovementsQuery, ListStockQuery } from './dto/list-queries.js';
import {
  StockItemView,
  StockMovementView,
  toMovementView,
  toStockItemView,
} from './stock-views.js';

const outbox = new OutboxWriter();
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type Tx = Prisma.TransactionClient;

export interface ReserveLine {
  product_id: string;
  quantity: number;
}
export type ReserveResult =
  | { ok: true }
  | { ok: false; shortfalls: { product_id: string; available: number }[] };

export interface MovementResult {
  movement: StockMovementView;
  on_hand: number;
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Reads ──────────────────────────────────────────────────────────────────

  async listStock(
    businessId: string,
    q: ListStockQuery,
  ): Promise<{ data: StockItemView[]; next_cursor: string | null }> {
    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const where: Prisma.StockItemWhereInput = {};
      if (q.active !== undefined) where.productActive = q.active === 'true';
      if (q.cursor) where.productId = { gt: q.cursor };
      const rows = await tx.stockItem.findMany({
        where,
        orderBy: { productId: 'asc' },
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      const next = rows.length > limit ? page[page.length - 1].productId : null;
      return { data: page.map(toStockItemView), next_cursor: next };
    });
  }

  async listMovements(
    businessId: string,
    q: ListMovementsQuery,
  ): Promise<{ data: StockMovementView[]; next_cursor: string | null }> {
    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const where: Prisma.StockMovementWhereInput = {};
      if (q.product_id) where.productId = q.product_id;
      if (q.type) where.type = q.type;
      if (q.cursor) where.id = { lt: q.cursor };
      const rows = await tx.stockMovement.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      const next = rows.length > limit ? page[page.length - 1].id : null;
      return { data: page.map(toMovementView), next_cursor: next };
    });
  }

  async listLowStock(businessId: string): Promise<{ data: StockItemView[] }> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      // `quantity <= reorder_threshold` is a column-to-column compare Prisma
      // can't express in `where`; filter the (small) candidate set in memory.
      const candidates = await tx.stockItem.findMany({
        where: { productActive: true, reorderThreshold: { gt: 0 } },
        orderBy: { productId: 'asc' },
      });
      return {
        data: candidates
          .filter((i) => i.quantity <= i.reorderThreshold)
          .map(toStockItemView),
      };
    });
  }

  // ── Manual movement ────────────────────────────────────────────────────────

  async recordMovement(
    businessId: string,
    userId: string,
    dto: RecordMovementDto,
    idempotencyKey?: string,
  ): Promise<MovementResult> {
    if (dto.type === 'stock_in' && dto.quantity_delta <= 0) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'A stock-in quantity must be greater than zero',
        details: [
          { field: 'quantity_delta', issue: 'must be > 0 for stock_in' },
        ],
      });
    }

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      if (idempotencyKey) {
        const prior = await tx.stockMovement.findUnique({
          where: {
            businessId_idempotencyKey: { businessId, idempotencyKey },
          },
        });
        if (prior) {
          const item = await tx.stockItem.findUnique({
            where: {
              businessId_productId: { businessId, productId: prior.productId },
            },
          });
          return {
            movement: toMovementView(prior),
            on_hand: item?.quantity ?? 0,
          };
        }
      }

      const item = await this.ensureItem(tx, businessId, dto.product_id);
      const newQty = item.quantity + dto.quantity_delta;
      if (newQty < 0) {
        throw new UnprocessableEntityException({
          code: 'insufficient_stock',
          message: 'That adjustment would drive on-hand below zero',
          devMessage: `on_hand ${item.quantity} + delta ${dto.quantity_delta} = ${newQty}`,
          details: [{ field: 'quantity_delta', issue: 'result below zero' }],
        });
      }

      let movementId: string;
      try {
        const created = await tx.stockMovement.create({
          data: {
            businessId,
            productId: dto.product_id,
            type: dto.type,
            quantityDelta: dto.quantity_delta,
            reason: dto.reason ?? null,
            referenceType: dto.reference_type ?? null,
            referenceId: dto.reference_id ?? null,
            createdBy: userId,
            idempotencyKey: idempotencyKey ?? null,
          },
        });
        movementId = created.id;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException({
            code: 'conflict',
            message: 'This movement was already recorded',
          });
        }
        throw error;
      }

      await this.applyToItem(tx, businessId, item, dto.product_id, newQty, {
        movementId,
        type: dto.type,
        delta: dto.quantity_delta,
      });

      const movement = await tx.stockMovement.findUniqueOrThrow({
        where: { id: movementId },
      });
      return { movement: toMovementView(movement), on_hand: newQty };
    });
  }

  // ── Reservation RPC ────────────────────────────────────────────────────────

  async reserve(
    businessId: string,
    reservationId: string,
    lines: ReserveLine[],
  ): Promise<ReserveResult> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const existing = await tx.stockReservation.findUnique({
        where: { id: reservationId },
      });
      if (existing) {
        return existing.status === 'released'
          ? { ok: false as const, shortfalls: [] }
          : { ok: true as const };
      }

      const held = await tx.stockReservation.findMany({
        where: { status: 'held' },
      });
      const heldQty = new Map<string, number>();
      for (const r of held) {
        for (const l of r.lines as unknown as ReserveLine[]) {
          heldQty.set(
            l.product_id,
            (heldQty.get(l.product_id) ?? 0) + l.quantity,
          );
        }
      }

      const ids = [...new Set(lines.map((l) => l.product_id))];
      const items = await tx.stockItem.findMany({
        where: { productId: { in: ids } },
      });
      const onHand = new Map(items.map((i) => [i.productId, i.quantity]));

      const shortfalls: { product_id: string; available: number }[] = [];
      for (const l of lines) {
        const available =
          (onHand.get(l.product_id) ?? 0) - (heldQty.get(l.product_id) ?? 0);
        if (available < l.quantity) {
          shortfalls.push({ product_id: l.product_id, available });
        }
      }
      if (shortfalls.length > 0) return { ok: false as const, shortfalls };

      await tx.stockReservation.create({
        data: {
          id: reservationId,
          businessId,
          status: 'held',
          lines: lines as unknown as Prisma.InputJsonValue,
        },
      });
      return { ok: true as const };
    });
  }

  async commit(
    businessId: string,
    reservationId: string,
    saleId: string,
  ): Promise<{ ok: boolean }> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const r = await tx.stockReservation.findUnique({
        where: { id: reservationId },
      });
      if (!r) return { ok: false };
      if (r.status === 'committed') return { ok: true };
      if (r.status === 'released') return { ok: false };

      for (const l of r.lines as unknown as ReserveLine[]) {
        const item = await this.ensureItem(tx, businessId, l.product_id);
        const newQty = item.quantity - l.quantity;
        const movement = await tx.stockMovement.create({
          data: {
            businessId,
            productId: l.product_id,
            type: 'sale',
            quantityDelta: -l.quantity,
            referenceType: 'sale',
            referenceId: saleId,
          },
        });
        if (newQty < 0) {
          this.logger.warn(
            `reservation ${reservationId} commit drove ${l.product_id} to ${newQty}`,
          );
        }
        await this.applyToItem(tx, businessId, item, l.product_id, newQty, {
          movementId: movement.id,
          type: 'sale',
          delta: -l.quantity,
        });
      }

      await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: 'committed', saleId, resolvedAt: new Date() },
      });
      return { ok: true };
    });
  }

  async release(
    businessId: string,
    reservationId: string,
  ): Promise<{ ok: boolean }> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const r = await tx.stockReservation.findUnique({
        where: { id: reservationId },
      });
      if (!r || r.status === 'released') return { ok: true };
      if (r.status === 'committed') return { ok: false };
      await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: 'released', resolvedAt: new Date() },
      });
      return { ok: true };
    });
  }

  // ── Consumer helpers (called from ProductEventsConsumer) ───────────────────

  async applyProductUpserted(
    businessId: string,
    p: { product_id: string; is_active: boolean; reorder_threshold: number },
  ): Promise<void> {
    await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.stockItem.upsert({
        where: {
          businessId_productId: { businessId, productId: p.product_id },
        },
        create: {
          businessId,
          productId: p.product_id,
          quantity: 0,
          reorderThreshold: p.reorder_threshold,
          productActive: p.is_active,
        },
        update: {
          reorderThreshold: p.reorder_threshold,
          productActive: p.is_active,
        },
      }),
    );
  }

  async applyProductDeactivated(
    businessId: string,
    productId: string,
  ): Promise<void> {
    await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.stockItem.updateMany({
        where: { productId },
        data: { productActive: false },
      }),
    );
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Load the product's stock row, creating a zero row if the ProductUpserted
   * event has not landed yet (async delivery race). */
  private async ensureItem(
    tx: Tx,
    businessId: string,
    productId: string,
  ): Promise<StockItem> {
    const existing = await tx.stockItem.findUnique({
      where: { businessId_productId: { businessId, productId } },
    });
    if (existing) return existing;
    this.logger.warn(
      `stock_item auto-created for ${productId} (ProductUpserted not seen yet)`,
    );
    return tx.stockItem.create({
      data: { businessId, productId, quantity: 0 },
    });
  }

  /** Persist the new quantity, move the low-stock edge state, and emit the
   * stock events. `low_stock_alert_state` is the edge source of truth. */
  private async applyToItem(
    tx: Tx,
    businessId: string,
    before: StockItem,
    productId: string,
    newQty: number,
    move: { movementId: string; type: string; delta: number },
  ): Promise<void> {
    const threshold = before.reorderThreshold;
    const nowOpen =
      threshold > 0 && before.productActive && newQty <= threshold;

    await tx.stockItem.update({
      where: { businessId_productId: { businessId, productId } },
      data: { quantity: newQty },
    });

    const edge = await tx.lowStockAlertState.findUnique({
      where: { businessId_productId: { businessId, productId } },
    });
    const wasOpen = edge?.isOpen ?? false;

    // Timestamp of the window an edge event refers to: the one we open now, or
    // the one we are closing.
    let windowOpenedAt: Date | undefined;
    if (nowOpen && !wasOpen) {
      windowOpenedAt = new Date();
      await tx.lowStockAlertState.upsert({
        where: { businessId_productId: { businessId, productId } },
        create: {
          businessId,
          productId,
          isOpen: true,
          openedAt: windowOpenedAt,
        },
        update: { isOpen: true, openedAt: windowOpenedAt, closedAt: null },
      });
    } else if (!nowOpen && wasOpen) {
      windowOpenedAt = edge?.openedAt ?? new Date();
      await tx.lowStockAlertState.update({
        where: { businessId_productId: { businessId, productId } },
        data: { isOpen: false, closedAt: new Date() },
      });
    }

    const envelope = (payload: unknown) =>
      makeEnvelope({
        producer: 'inventory',
        businessId,
        schemaVersion: SCHEMA_VERSION,
        payload,
      });

    await outbox.write(tx, {
      subject: SUBJECTS.inventory.stockMovementRecorded,
      payload: envelope({
        business_id: businessId,
        product_id: productId,
        movement_id: move.movementId,
        type: move.type,
        quantity_delta: move.delta,
      }),
    });
    await outbox.write(tx, {
      subject: SUBJECTS.inventory.stockLevelChanged,
      payload: envelope({
        business_id: businessId,
        product_id: productId,
        on_hand: newQty,
      }),
    });

    if (nowOpen && !wasOpen) {
      const cfg = await tx.alertConfig.findUnique({ where: { businessId } });
      const recipients = Array.isArray(cfg?.recipients)
        ? (cfg.recipients as string[])
        : [];
      await outbox.write(tx, {
        subject: SUBJECTS.inventory.stockFellBelowThreshold,
        payload: envelope({
          business_id: businessId,
          product_id: productId,
          on_hand: newQty,
          threshold,
          opened_at: windowOpenedAt!.toISOString(),
          recipients,
        }),
      });
    } else if (!nowOpen && wasOpen) {
      await outbox.write(tx, {
        subject: SUBJECTS.inventory.stockRecovered,
        payload: envelope({
          business_id: businessId,
          product_id: productId,
          on_hand: newQty,
          opened_at: windowOpenedAt!.toISOString(),
        }),
      });
    }
  }
}
