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
const biz = uuidv7();
const ownerId = uuidv7();

const owner = () => {
  const { header, signature } = signInternalContext(
    {
      request_id: `c-${uuidv7()}`,
      user_id: ownerId,
      business_id: biz,
      role: 'owner',
      token_kind: 'user',
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
};

const upsert = (productId: string) =>
  makeEnvelope({
    producer: 'catalog',
    businessId: biz,
    schemaVersion: '1.0.0',
    payload: {
      business_id: biz,
      product_id: productId,
      sku: `SKU-${productId.slice(0, 8)}`,
      name: 'C',
      unit: 'each',
      is_active: true,
      reorder_threshold: 0,
    },
  });

const movementsUrl = `/v1/businesses/${biz}/stock/movements`;

async function onHand(productId: string): Promise<number> {
  const item = await prisma.runInTenantContext(biz, (tx) =>
    tx.stockItem.findFirst({ where: { productId } }),
  );
  return item?.quantity ?? 0;
}

async function ledgerSum(productId: string): Promise<number> {
  const rows = await prisma.runInTenantContext(biz, (tx) =>
    tx.stockMovement.findMany({ where: { productId } }),
  );
  return rows.reduce((a, m) => a + m.quantityDelta, 0);
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
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
  await prisma.runInTenantContext(biz, async (tx) => {
    await tx.stockReservation.deleteMany({});
    await tx.stockMovement.deleteMany({});
    await tx.stockItem.deleteMany({});
  });
  await app.close();
});

describe('inventory — concurrency / no lost update', () => {
  it('K concurrent single-unit reservations never over-reserve N on-hand', async () => {
    const N = 10;
    const K = 25;

    for (let run = 0; run < 3; run++) {
      const productId = uuidv7();
      await consumer.onUpserted(upsert(productId));
      await http
        .post(movementsUrl)
        .set(owner())
        .send({ product_id: productId, type: 'stock_in', quantity_delta: N })
        .expect(201);

      const results = await Promise.all(
        Array.from({ length: K }, () =>
          stock.reserve(biz, uuidv7(), [
            { product_id: productId, quantity: 1 },
          ]),
        ),
      );
      const ok = results.filter((r) => r.ok).length;
      const shortfall = results.filter((r) => !r.ok).length;

      expect(ok, `run ${run}: exactly N reservations succeed`).toBe(N);
      expect(shortfall, `run ${run}: the rest are shortfalls`).toBe(K - N);

      // Commit every held reservation → on-hand must land at exactly 0, never below.
      const held = await prisma.runInTenantContext(biz, (tx) =>
        tx.stockReservation.findMany({ where: { status: 'held' } }),
      );
      for (const r of held) {
        await stock.commit(biz, r.id, uuidv7());
      }
      expect(await onHand(productId), `run ${run}: on_hand`).toBe(0);
      expect(await ledgerSum(productId), `run ${run}: ledger`).toBe(0); // +N stock_in, -N sales
    }
  });

  it('K concurrent stock-in movements sum exactly', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsert(productId));
    const K = 25;
    const q = 3;

    await Promise.all(
      Array.from({ length: K }, () =>
        http
          .post(movementsUrl)
          .set(owner())
          .send({ product_id: productId, type: 'stock_in', quantity_delta: q }),
      ),
    );

    expect(await onHand(productId)).toBe(K * q);
    const rows = await prisma.runInTenantContext(biz, (tx) =>
      tx.stockMovement.count({ where: { productId, type: 'stock_in' } }),
    );
    expect(rows).toBe(K);
  });

  it('K concurrent reservations sharing one id yield exactly one hold', async () => {
    const productId = uuidv7();
    await consumer.onUpserted(upsert(productId));
    await http
      .post(movementsUrl)
      .set(owner())
      .send({ product_id: productId, type: 'stock_in', quantity_delta: 50 })
      .expect(201);

    const rid = uuidv7();
    await Promise.all(
      Array.from({ length: 25 }, () =>
        stock.reserve(biz, rid, [{ product_id: productId, quantity: 1 }]),
      ),
    );
    await stock.commit(biz, rid, uuidv7());

    expect(await onHand(productId)).toBe(49);
    const sales = await prisma.runInTenantContext(biz, (tx) =>
      tx.stockMovement.count({ where: { productId, type: 'sale' } }),
    );
    expect(sales).toBe(1);
  });
});
