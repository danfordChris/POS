import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { uuidv7 } from 'uuidv7';
import {
  configureApp,
  registerNotFoundFallback,
  signInternalContext,
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_CONTEXT_SIGNATURE_HEADER,
  MESSAGE_BUS,
} from '@pos/nest-common';
import { SUBJECTS, makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StockService } from '../src/stock/stock.service.js';
import { ProductEventsConsumer } from '../src/consumers/product-events.consumer.js';
import { SaleVoidedConsumer } from '../src/consumers/sale-voided.consumer.js';

let app: INestApplication;
let prisma: PrismaService;
let stock: StockService;
let consumer: ProductEventsConsumer;
let saleVoided: SaleVoidedConsumer;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
const bizC = uuidv7();
const ownerId = uuidv7();

function ctx(businessId: string | null, kind: 'user' | 'operator' = 'user') {
  const { header, signature } = signInternalContext(
    {
      request_id: `t-${uuidv7()}`,
      user_id: kind === 'operator' ? null : ownerId,
      business_id: businessId,
      role: kind === 'operator' ? null : 'owner',
      token_kind: kind,
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}
const owA = () => ctx(bizA);

function upsertEnvelope(
  businessId: string,
  productId: string,
  opts: {
    active?: boolean;
    threshold?: number;
  },
) {
  return makeEnvelope({
    producer: 'catalog',
    businessId,
    schemaVersion: '1.0.0',
    payload: {
      business_id: businessId,
      product_id: productId,
      sku: `SKU-${productId.slice(0, 8)}`,
      name: 'Test product',
      unit: 'each',
      is_active: opts.active ?? true,
      reorder_threshold: opts.threshold ?? 0,
    },
  });
}

beforeAll(async () => {
  const bus = new InMemoryBus();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(bus)
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);

  prisma = app.get(PrismaService);
  stock = app.get(StockService);
  consumer = app.get(ProductEventsConsumer);
  saleVoided = app.get(SaleVoidedConsumer);
  http = request(app.getHttpServer());
});

afterAll(async () => {
  for (const b of [bizA, bizB, bizC]) {
    await prisma.runInTenantContext(b, async (tx) => {
      await tx.stockMovement.deleteMany({});
      await tx.stockReservation.deleteMany({});
      await tx.lowStockAlertState.deleteMany({});
      await tx.alertConfig.deleteMany({});
      await tx.stockItem.deleteMany({});
    });
  }
  await prisma.$executeRawUnsafe(`DELETE FROM outbox`);
  await prisma.$executeRawUnsafe(`DELETE FROM processed_events`);
  await app.close();
});

const movementsUrl = `/v1/businesses/${bizA}/stock/movements`;

describe('inventory — manual movements', () => {
  it('stock_in raises on-hand by exactly N and writes one movement', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, productId, {}));

    const res = await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 10 })
      .expect(201);
    expect(res.body.on_hand).toBe(10);

    const list = await http
      .get(`/v1/businesses/${bizA}/stock`)
      .set(owA())
      .expect(200);
    const row = list.body.data.find(
      (r: { product_id: string }) => r.product_id === productId,
    );
    expect(row.on_hand).toBe(10);

    const moves = await http
      .get(movementsUrl)
      .query({ product_id: productId })
      .set(owA())
      .expect(200);
    expect(moves.body.data).toHaveLength(1);
    expect(moves.body.data[0].type).toBe('stock_in');
  });

  it('keeps quantity == sum(quantity_delta) across a random sequence', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, productId, {}));
    let expected = 0;

    for (let i = 0; i < 25; i += 1) {
      const stockIn = Math.random() < 0.6 || expected === 0;
      const delta = stockIn
        ? 1 + Math.floor(Math.random() * 20)
        : -(1 + Math.floor(Math.random() * Math.max(1, expected)));
      if (expected + delta < 0) continue;
      await http
        .post(movementsUrl)
        .set(owA())
        .send({
          product_id: productId,
          type: stockIn ? 'stock_in' : 'adjustment',
          quantity_delta: delta,
        })
        .expect(201);
      expected += delta;
    }

    const [item, agg] = await prisma.runInTenantContext(bizA, (tx) =>
      Promise.all([
        tx.stockItem.findUniqueOrThrow({
          where: { businessId_productId: { businessId: bizA, productId } },
        }),
        tx.stockMovement.aggregate({
          where: { productId },
          _sum: { quantityDelta: true },
        }),
      ]),
    );
    expect(item.quantity).toBe(expected);
    expect(item.quantity).toBe(agg._sum.quantityDelta ?? 0);
  });

  it('rejects an adjustment that would go below zero (422)', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, productId, {}));
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 3 })
      .expect(201);
    const res = await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'adjustment', quantity_delta: -5 })
      .expect(422);
    expect(res.body.error.code).toBe('insufficient_stock');
  });

  it('replays an Idempotency-Key: one movement, on-hand unchanged', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, productId, {}));
    const key = `idem-${uuidv7()}`;
    const first = await http
      .post(movementsUrl)
      .set(owA())
      .set('Idempotency-Key', key)
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 7 })
      .expect(201);
    const second = await http
      .post(movementsUrl)
      .set(owA())
      .set('Idempotency-Key', key)
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 7 })
      .expect(201);
    expect(second.body.movement.id).toBe(first.body.movement.id);
    expect(second.body.on_hand).toBe(7);

    const moves = await prisma.runInTenantContext(bizA, (tx) =>
      tx.stockMovement.count({ where: { productId } }),
    );
    expect(moves).toBe(1);
  });
});

describe('inventory — low stock', () => {
  it('lists exactly the products at or below their reorder threshold', async () => {
    const low = uuidv7();
    const ok = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, low, { threshold: 6 }));
    await consumer.onUpserted(upsertEnvelope(bizA, ok, { threshold: 6 }));
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: low, type: 'stock_in', quantity_delta: 4 })
      .expect(201);
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: ok, type: 'stock_in', quantity_delta: 20 })
      .expect(201);

    const res = await http
      .get(`/v1/businesses/${bizA}/stock/low`)
      .set(owA())
      .expect(200);
    const ids = res.body.data.map((r: { product_id: string }) => r.product_id);
    expect(ids).toContain(low);
    expect(ids).not.toContain(ok);
  });
});

describe('inventory — low-stock alert edge', () => {
  const clearOutbox = () => prisma.$executeRawUnsafe('DELETE FROM outbox');

  type EdgePayload = {
    product_id: string;
    on_hand: number;
    threshold?: number;
    opened_at: string;
    recipients?: string[];
  };
  const emitted = async (subject: string, productId: string) => {
    const rows = await prisma.outboxMessage.findMany({ where: { subject } });
    return rows
      .map((r) => (r.payload as { payload: EdgePayload }).payload)
      .filter((p) => p.product_id === productId);
  };
  const edgeRow = (productId: string) =>
    prisma.runInTenantContext(bizA, (tx) =>
      tx.lowStockAlertState.findUnique({
        where: { businessId_productId: { businessId: bizA, productId } },
      }),
    );

  it('opens the edge in-transaction with opened_at + alert-config recipients', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(
      upsertEnvelope(bizA, productId, { threshold: 5 }),
    );
    await http
      .put(`/v1/businesses/${bizA}/alert-config`)
      .set(owA())
      .send({ recipients: ['ops@a.com'], min_interval_hours: 12 })
      .expect(200);
    await clearOutbox();

    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 3 })
      .expect(201);

    const state = await edgeRow(productId);
    expect(state?.isOpen).toBe(true);
    expect(state?.openedAt).toBeInstanceOf(Date);

    const fell = await emitted(
      SUBJECTS.inventory.stockFellBelowThreshold,
      productId,
    );
    expect(fell).toHaveLength(1);
    expect(fell[0].opened_at).toBe(state!.openedAt!.toISOString());
    expect(fell[0].threshold).toBe(5);
    expect(fell[0].recipients).toEqual(['ops@a.com']);
  });

  it('does not re-emit while the window stays open', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(
      upsertEnvelope(bizA, productId, { threshold: 5 }),
    );
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 4 })
      .expect(201);
    await clearOutbox();

    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'adjustment', quantity_delta: -1 })
      .expect(201);

    expect(
      await emitted(SUBJECTS.inventory.stockFellBelowThreshold, productId),
    ).toHaveLength(0);
    expect((await edgeRow(productId))?.isOpen).toBe(true);
  });

  it('recovers with the matching opened_at, then re-opens with a fresh one', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(
      upsertEnvelope(bizA, productId, { threshold: 5 }),
    );
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 3 })
      .expect(201);
    const firstOpenedAt = (await edgeRow(productId))!.openedAt!.toISOString();
    await clearOutbox();

    // Recover: on-hand 3 -> 13 (> 5).
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 10 })
      .expect(201);

    const closed = await edgeRow(productId);
    expect(closed?.isOpen).toBe(false);
    expect(closed?.closedAt).toBeInstanceOf(Date);
    const recovered = await emitted(
      SUBJECTS.inventory.stockRecovered,
      productId,
    );
    expect(recovered).toHaveLength(1);
    expect(recovered[0].opened_at).toBe(firstOpenedAt);
    await clearOutbox();

    // Dip again: 13 -> 2. New window, new opened_at.
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'adjustment', quantity_delta: -11 })
      .expect(201);

    const reopened = await edgeRow(productId);
    expect(reopened?.isOpen).toBe(true);
    const fell = await emitted(
      SUBJECTS.inventory.stockFellBelowThreshold,
      productId,
    );
    expect(fell).toHaveLength(1);
    expect(fell[0].opened_at).toBe(reopened!.openedAt!.toISOString());
    expect(fell[0].opened_at).not.toBe(firstOpenedAt);
  });

  it('emits recipients: [] when the business has no alert-config', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(
      upsertEnvelope(bizC, productId, { threshold: 4 }),
    );
    await clearOutbox();

    await http
      .post(`/v1/businesses/${bizC}/stock/movements`)
      .set(ctx(bizC))
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 2 })
      .expect(201);

    const fell = (
      await prisma.outboxMessage.findMany({
        where: { subject: SUBJECTS.inventory.stockFellBelowThreshold },
      })
    )
      .map((r) => (r.payload as { payload: EdgePayload }).payload)
      .filter((p) => p.product_id === productId);
    expect(fell).toHaveLength(1);
    expect(fell[0].recipients).toEqual([]);
  });
});

describe('inventory — catalog consumer', () => {
  it('seeds stock_item and is idempotent on event_id', async () => {
    const productId = uuidv7();
    const evt = upsertEnvelope(bizA, productId, { threshold: 9 });
    await consumer.onUpserted(evt);
    await consumer.onUpserted(evt);

    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM processed_events WHERE event_id = $1::uuid`,
      evt.event_id,
    );
    expect(Number(rows[0].n)).toBe(1);

    const item = await prisma.runInTenantContext(bizA, (tx) =>
      tx.stockItem.findUniqueOrThrow({
        where: { businessId_productId: { businessId: bizA, productId } },
      }),
    );
    expect(item.reorderThreshold).toBe(9);
    expect(item.productActive).toBe(true);
  });

  it('ProductDeactivated flips product_active off', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, productId, {}));
    await consumer.onDeactivated(
      makeEnvelope({
        producer: 'catalog',
        businessId: bizA,
        schemaVersion: '1.0.0',
        payload: { business_id: bizA, product_id: productId },
      }),
    );
    const item = await prisma.runInTenantContext(bizA, (tx) =>
      tx.stockItem.findUniqueOrThrow({
        where: { businessId_productId: { businessId: bizA, productId } },
      }),
    );
    expect(item.productActive).toBe(false);
  });
});

describe('inventory — reservation RPC', () => {
  it('reserve holds against on-hand; commit writes a sale movement; both idempotent', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, productId, {}));
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 20 })
      .expect(201);

    const r1 = uuidv7();
    expect(
      await stock.reserve(bizA, r1, [{ product_id: productId, quantity: 5 }]),
    ).toEqual({ ok: true });
    // idempotent replay
    expect(
      await stock.reserve(bizA, r1, [{ product_id: productId, quantity: 5 }]),
    ).toEqual({ ok: true });

    // a second reservation can only see 15 available
    const r2 = uuidv7();
    const res2 = await stock.reserve(bizA, r2, [
      { product_id: productId, quantity: 20 },
    ]);
    expect(res2).toEqual({
      ok: false,
      shortfalls: [{ product_id: productId, available: 15 }],
    });

    const saleId = uuidv7();
    expect(await stock.commit(bizA, r1, saleId)).toEqual({ ok: true });
    expect(await stock.commit(bizA, r1, saleId)).toEqual({ ok: true });

    const item = await prisma.runInTenantContext(bizA, (tx) =>
      tx.stockItem.findUniqueOrThrow({
        where: { businessId_productId: { businessId: bizA, productId } },
      }),
    );
    expect(item.quantity).toBe(15);

    const sale = await prisma.runInTenantContext(bizA, (tx) =>
      tx.stockMovement.findFirst({ where: { productId, type: 'sale' } }),
    );
    expect(sale?.quantityDelta).toBe(-5);
  });

  it('release is idempotent and cannot release a committed reservation', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, productId, {}));
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 10 })
      .expect(201);

    const r = uuidv7();
    await stock.reserve(bizA, r, [{ product_id: productId, quantity: 3 }]);
    expect(await stock.release(bizA, r)).toEqual({ ok: true });
    expect(await stock.release(bizA, r)).toEqual({ ok: true });

    const committed = uuidv7();
    await stock.reserve(bizA, committed, [
      { product_id: productId, quantity: 2 },
    ]);
    await stock.commit(bizA, committed, uuidv7());
    expect(await stock.release(bizA, committed)).toEqual({ ok: false });
  });
});

describe('inventory — SaleVoided consumer', () => {
  it('reverses stock to pre-sale on-hand and is idempotent on event_id', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsertEnvelope(bizA, productId, {}));
    await http
      .post(movementsUrl)
      .set(owA())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 12 })
      .expect(201);

    // A sale committed via the reservation RPC took 5 off.
    const r = uuidv7();
    await stock.reserve(bizA, r, [{ product_id: productId, quantity: 5 }]);
    const saleId = uuidv7();
    await stock.commit(bizA, r, saleId);

    const midQty = await prisma.runInTenantContext(bizA, (tx) =>
      tx.stockItem.findUniqueOrThrow({
        where: { businessId_productId: { businessId: bizA, productId } },
      }),
    );
    expect(midQty.quantity).toBe(7);

    const evt = makeEnvelope({
      producer: 'sales',
      businessId: bizA,
      schemaVersion: '1.1.0',
      payload: {
        business_id: bizA,
        sale_id: saleId,
        lines: [{ product_id: productId, quantity: 5 }],
      },
    });
    await saleVoided.handle(evt);
    await saleVoided.handle(evt); // idempotent

    const after = await prisma.runInTenantContext(bizA, async (tx) => ({
      quantity: (
        await tx.stockItem.findUniqueOrThrow({
          where: { businessId_productId: { businessId: bizA, productId } },
        })
      ).quantity,
      reversals: await tx.stockMovement.count({
        where: { productId, type: 'void_reversal', referenceId: saleId },
      }),
    }));
    expect(after.quantity).toBe(12); // back to pre-sale
    expect(after.reversals).toBe(1); // one movement, not two
  });
});

describe('inventory — guards', () => {
  it('rejects an operator context with operator_data_access_denied', async () => {
    const res = await http
      .get(`/v1/businesses/${bizA}/stock`)
      .set(ctx(bizA, 'operator'))
      .expect(403);
    expect(res.body.error.code).toBe('operator_data_access_denied');
  });

  it('tenant isolation: business B sees none of business A stock', async () => {
    const res = await http
      .get(`/v1/businesses/${bizB}/stock`)
      .set(ctx(bizB))
      .expect(200);
    expect(res.body.data).toHaveLength(0);
  });
});
