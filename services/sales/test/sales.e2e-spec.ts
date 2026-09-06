import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { uuidv7 } from 'uuidv7';
import { vi } from 'vitest';
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
import { SalesService } from '../src/sales/sales.service.js';
import { ProductCacheConsumer } from '../src/sales/consumers/product-cache.consumer.js';
import { BusinessCacheConsumer } from '../src/sales/consumers/business-cache.consumer.js';
import { InventoryClient } from '../src/rpc/inventory-client.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;
let sales: SalesService;
let products: ProductCacheConsumer;
let businesses: BusinessCacheConsumer;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
const bizC = uuidv7();
const staffId = uuidv7();

const inv = {
  reserveStock: vi.fn(async () => ({ ok: true as const })),
  commitReservation: vi.fn(async () => ({ ok: true })),
  releaseReservation: vi.fn(async () => ({ ok: true })),
};

function ctx(businessId: string, role: 'owner' | 'staff' = 'staff') {
  const { header, signature } = signInternalContext(
    {
      request_id: `t-${uuidv7()}`,
      user_id: staffId,
      business_id: businessId,
      role,
      token_kind: 'user',
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

const salesUrl = (biz: string) => `/v1/businesses/${biz}/sales`;

async function seedProduct(
  biz: string,
  productId: string,
  name: string,
  price: number,
) {
  await products.onUpserted(
    makeEnvelope({
      producer: 'catalog',
      businessId: biz,
      schemaVersion: '1.0.0',
      payload: {
        business_id: biz,
        product_id: productId,
        sku: `SKU-${productId.slice(0, 6)}`,
        name,
        unit: 'each',
        is_active: true,
        reorder_threshold: 0,
      },
    }),
  );
  await products.onPriceChanged(
    makeEnvelope({
      producer: 'catalog',
      businessId: biz,
      schemaVersion: '1.0.0',
      payload: {
        business_id: biz,
        product_id: productId,
        sell_price: price,
        winger_price: null,
        currency: 'TZS',
      },
    }),
  );
}

const outboxSaleCompleted = (biz: string) =>
  prisma.outboxMessage
    .findMany({ where: { subject: SUBJECTS.sales.saleCompleted } })
    .then((rs) =>
      rs
        .map((r) => (r.payload as { payload: { business_id: string } }).payload)
        .filter((p) => p.business_id === biz),
    );

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .overrideProvider(InventoryClient)
    .useValue(inv)
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);

  prisma = app.get(PrismaService);
  sales = app.get(SalesService);
  products = app.get(ProductCacheConsumer);
  businesses = app.get(BusinessCacheConsumer);
  http = request(app.getHttpServer());

  for (const b of [bizA, bizB, bizC]) {
    await businesses.onBusinessCreated(
      makeEnvelope({
        producer: 'tenancy',
        businessId: b,
        schemaVersion: '1.1.0',
        payload: {
          business_id: b,
          name: `Shop ${b.slice(0, 4)}`,
          currency: 'TZS',
          locale: 'en',
          owner_user_id: uuidv7(),
        },
      }),
    );
  }
});

afterEach(() => {
  inv.reserveStock.mockClear();
  inv.commitReservation.mockClear();
  inv.releaseReservation.mockClear();
  inv.reserveStock.mockResolvedValue({ ok: true } as never);
});

afterAll(async () => {
  for (const b of [bizA, bizB, bizC]) {
    await prisma.runInTenantContext(b, async (tx) => {
      await tx.saleLine.deleteMany({});
      await tx.receipt.deleteMany({});
      await tx.sale.deleteMany({});
      await tx.saleNumberCounter.deleteMany({});
      await tx.productCache.deleteMany({});
    });
  }
  await prisma.$executeRawUnsafe('DELETE FROM sales_business');
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await prisma.$executeRawUnsafe('DELETE FROM processed_events');
  await app.close();
});

describe('sales — POST /sales', () => {
  it('completes a sale: totals, per-business number, one receipt + one SaleCompleted', async () => {
    const p1 = uuidv7();
    const p2 = uuidv7();
    await seedProduct(bizA, p1, 'Sukari 1kg', 2500);
    await seedProduct(bizA, p2, 'Mchele 2kg', 4000);

    const res = await http
      .post(salesUrl(bizA))
      .set(ctx(bizA))
      .send({
        lines: [
          { product_id: p1, quantity: 2 },
          { product_id: p2, quantity: 1, discount: 500 },
        ],
      })
      .expect(201);

    expect(res.body).toMatchObject({
      number: 1,
      status: 'completed',
      subtotal: 2500 * 2 + 4000,
      discount_total: 500,
      total: 2500 * 2 + 4000 - 500,
      currency: 'TZS',
    });
    expect(res.body.lines).toHaveLength(2);
    expect(res.body.receipt.public_token).toEqual(expect.any(String));
    expect(inv.commitReservation).toHaveBeenCalledWith(
      expect.objectContaining({ sale_id: res.body.id }),
    );
    expect(await outboxSaleCompleted(bizA)).toHaveLength(1);

    const second = await http
      .post(salesUrl(bizA))
      .set(ctx(bizA))
      .send({ lines: [{ product_id: p1, quantity: 1 }] })
      .expect(201);
    expect(second.body.number).toBe(2);
  });

  it('replays the same Idempotency-Key without a second sale or event', async () => {
    const p = uuidv7();
    await seedProduct(bizB, p, 'Chumvi', 1000);
    const key = `idem-${uuidv7()}`;

    const first = await http
      .post(salesUrl(bizB))
      .set(ctx(bizB))
      .set('Idempotency-Key', key)
      .send({ lines: [{ product_id: p, quantity: 3 }] })
      .expect(201);
    const again = await http
      .post(salesUrl(bizB))
      .set(ctx(bizB))
      .set('Idempotency-Key', key)
      .send({ lines: [{ product_id: p, quantity: 3 }] })
      .expect(201);

    expect(again.body.id).toBe(first.body.id);
    expect(again.body.number).toBe(first.body.number);
    const count = await prisma.runInTenantContext(bizB, (tx) =>
      tx.sale.count({ where: { idempotencyKey: key } }),
    );
    expect(count).toBe(1);
    expect(await outboxSaleCompleted(bizB)).toHaveLength(1);
    expect(inv.reserveStock).toHaveBeenCalledTimes(1); // not re-reserved on replay
  });

  it('400 when a line has no cached price and no unit_price', async () => {
    const res = await http
      .post(salesUrl(bizA))
      .set(ctx(bizA))
      .send({ lines: [{ product_id: uuidv7(), quantity: 1 }] })
      .expect(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('422 insufficient_stock — full shortfall, zero writes, no release', async () => {
    const p = uuidv7();
    await seedProduct(bizA, p, 'Maharage', 3000);
    inv.reserveStock.mockResolvedValueOnce({
      ok: false,
      shortfalls: [{ product_id: p, available: 2 }],
    } as never);
    const outboxBefore = (await outboxSaleCompleted(bizA)).length;

    const res = await http
      .post(salesUrl(bizA))
      .set(ctx(bizA))
      .send({ lines: [{ product_id: p, quantity: 10 }] })
      .expect(422);
    expect(res.body.error.code).toBe('insufficient_stock');
    expect(res.body.error.details[0].issue).toContain(p);
    expect(res.body.error.details[0].issue).toContain('requested 10');

    const rows = await prisma.runInTenantContext(bizA, async (tx) => ({
      lines: await tx.saleLine.count({ where: { productId: p } }),
      receipts: await tx.receipt.count(),
    }));
    expect(rows.lines).toBe(0);
    expect((await outboxSaleCompleted(bizA)).length).toBe(outboxBefore);
    expect(inv.releaseReservation).not.toHaveBeenCalled();
  });

  it('422 when only one line of a multi-line cart is short — still zero writes', async () => {
    const ok = uuidv7();
    const short = uuidv7();
    await seedProduct(bizA, ok, 'Sabuni', 800);
    await seedProduct(bizA, short, 'Mafuta', 6000);
    inv.reserveStock.mockResolvedValueOnce({
      ok: false,
      shortfalls: [{ product_id: short, available: 1 }],
    } as never);

    await http
      .post(salesUrl(bizA))
      .set(ctx(bizA))
      .send({
        lines: [
          { product_id: ok, quantity: 1 },
          { product_id: short, quantity: 5 },
        ],
      })
      .expect(422);

    const n = await prisma.runInTenantContext(bizA, (tx) =>
      tx.saleLine.count({ where: { productId: { in: [ok, short] } } }),
    );
    expect(n).toBe(0);
    expect(inv.releaseReservation).not.toHaveBeenCalled();
  });

  it('503 when reserveStock is unavailable — no sale rows, no release', async () => {
    const p = uuidv7();
    await seedProduct(bizA, p, 'Soda', 1500);
    inv.reserveStock.mockRejectedValueOnce(
      Object.assign(new Error('no responders'), {}),
    );

    // The stubbed client throws a plain error; the real client would map it to
    // 503. Here we assert the error propagates and nothing is written.
    await expect(
      sales.createSale(bizA, staffId, {
        lines: [{ product_id: p, quantity: 1 }],
      }),
    ).rejects.toThrow();
    expect(inv.releaseReservation).not.toHaveBeenCalled();
    const n = await prisma.runInTenantContext(bizA, (tx) =>
      tx.sale.count({ where: { lines: { some: { productId: p } } } }),
    );
    expect(n).toBe(0);
  });

  it('releases the reservation once when the write txn fails after reserveStock', async () => {
    const p = uuidv7();
    await seedProduct(bizC, p, 'Maziwa', 1800);
    // First sale claims number 1.
    await sales.createSale(bizC, staffId, {
      lines: [{ product_id: p, quantity: 1 }],
    });
    const before = await prisma.runInTenantContext(bizC, (tx) =>
      tx.sale.count(),
    );
    // Force the counter to re-hand out number 1 → the next sale.create hits the
    // (business_id, number) unique and the txn rolls back.
    await prisma.runInTenantContext(bizC, (tx) =>
      tx.saleNumberCounter.update({
        where: { businessId: bizC },
        data: { nextNumber: 1 },
      }),
    );
    inv.releaseReservation.mockClear();

    await expect(
      sales.createSale(bizC, staffId, {
        lines: [{ product_id: p, quantity: 1 }],
      }),
    ).rejects.toThrow();

    expect(inv.releaseReservation).toHaveBeenCalledTimes(1);
    const after = await prisma.runInTenantContext(bizC, (tx) =>
      tx.sale.count(),
    );
    expect(after).toBe(before); // no new sale row
  });
});

describe('sales — POST /sales/:id/void', () => {
  async function makeSale(biz: string) {
    const p = uuidv7();
    await seedProduct(biz, p, 'Widget', 1200);
    const res = await http
      .post(salesUrl(biz))
      .set(ctx(biz))
      .send({ lines: [{ product_id: p, quantity: 2 }] })
      .expect(201);
    return { saleId: res.body.id as string, productId: p };
  }
  const outboxVoided = (biz: string) =>
    prisma.outboxMessage
      .findMany({ where: { subject: SUBJECTS.sales.saleVoided } })
      .then((rs) =>
        rs
          .map(
            (r) => (r.payload as { payload: { business_id: string } }).payload,
          )
          .filter((p) => p.business_id === biz),
      );

  it('Owner void marks the sale + receipt voided and emits SaleVoided with the lines', async () => {
    const { saleId, productId } = await makeSale(bizA);

    const res = await http
      .post(`${salesUrl(bizA)}/${saleId}/void`)
      .set(ctx(bizA, 'owner'))
      .expect(200);
    expect(res.body).toMatchObject({ id: saleId, status: 'voided' });
    expect(res.body.receipt.status).toBe('void');
    expect(res.body.voided_at).toEqual(expect.any(String));

    const emitted = await outboxVoided(bizA);
    const mine = emitted.filter(
      (e) => (e as { sale_id: string }).sale_id === saleId,
    );
    expect(mine).toHaveLength(1);
    expect((mine[0] as { lines: unknown[] }).lines).toEqual([
      { product_id: productId, quantity: 2 },
    ]);
  });

  it('Staff → 403 role_forbidden', async () => {
    const { saleId } = await makeSale(bizA);
    const res = await http
      .post(`${salesUrl(bizA)}/${saleId}/void`)
      .set(ctx(bizA, 'staff'))
      .expect(403);
    expect(res.body.error.code).toBe('role_forbidden');
  });

  it('unknown sale → 404', async () => {
    const res = await http
      .post(`${salesUrl(bizA)}/${uuidv7()}/void`)
      .set(ctx(bizA, 'owner'))
      .expect(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('re-void is idempotent — 200, no second SaleVoided', async () => {
    const { saleId } = await makeSale(bizB);
    await http
      .post(`${salesUrl(bizB)}/${saleId}/void`)
      .set(ctx(bizB, 'owner'))
      .expect(200);
    await http
      .post(`${salesUrl(bizB)}/${saleId}/void`)
      .set(ctx(bizB, 'owner'))
      .expect(200);

    const mine = (await outboxVoided(bizB)).filter(
      (e) => (e as { sale_id: string }).sale_id === saleId,
    );
    expect(mine).toHaveLength(1);
  });
});

describe('sales — GET /v1/r/:token (public)', () => {
  async function saleWithReceipt(biz: string) {
    const p = uuidv7();
    await seedProduct(biz, p, 'Notebook', 3500);
    const res = await http
      .post(salesUrl(biz))
      .set(ctx(biz))
      .send({ lines: [{ product_id: p, quantity: 2, discount: 500 }] })
      .expect(201);
    return {
      saleId: res.body.id as string,
      token: res.body.receipt.public_token as string,
    };
  }

  it('returns the receipt with no auth and no internal IDs', async () => {
    const { token } = await saleWithReceipt(bizA);

    const res = await http.get(`/v1/r/${token}`).expect(200);
    expect(res.body).toMatchObject({
      number: expect.any(Number),
      status: 'issued',
      business_name: expect.any(String),
      currency: 'TZS',
      subtotal: 7000,
      discount_total: 500,
      total: 6500,
    });
    expect(res.body.lines).toEqual([
      {
        name: 'Notebook',
        unit_price: 3500,
        quantity: 2,
        discount: 500,
        line_total: 6500,
      },
    ]);
    const blob = JSON.stringify(res.body);
    for (const bad of [
      'business_id',
      'sale_id',
      'product_id',
      'user_id',
      '"id"',
    ]) {
      expect(blob).not.toContain(bad);
    }
  });

  it('unknown token → 404', async () => {
    const res = await http.get('/v1/r/does-not-exist').expect(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('a voided sale returns 404', async () => {
    const { saleId, token } = await saleWithReceipt(bizB);
    await http
      .post(`${salesUrl(bizB)}/${saleId}/void`)
      .set(ctx(bizB, 'owner'))
      .expect(200);
    await http.get(`/v1/r/${token}`).expect(404);
  });
});
