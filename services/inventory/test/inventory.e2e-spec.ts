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
import { makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StockService } from '../src/stock/stock.service.js';
import { ProductEventsConsumer } from '../src/consumers/product-events.consumer.js';

let app: INestApplication;
let prisma: PrismaService;
let stock: StockService;
let consumer: ProductEventsConsumer;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
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
  http = request(app.getHttpServer());
});

afterAll(async () => {
  for (const b of [bizA, bizB]) {
    await prisma.runInTenantContext(b, async (tx) => {
      await tx.stockMovement.deleteMany({});
      await tx.stockReservation.deleteMany({});
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
