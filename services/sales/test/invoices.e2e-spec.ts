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
const ownerId = uuidv7();
const staffId = uuidv7();

const inv = {
  reserveStock: vi.fn(async () => ({ ok: true as const })),
  commitReservation: vi.fn(async () => ({ ok: true })),
  releaseReservation: vi.fn(async () => ({ ok: true })),
};

function ctx(biz: string, role: 'owner' | 'staff' = 'owner', userId = ownerId) {
  const { header, signature } = signInternalContext(
    {
      request_id: `t-${uuidv7()}`,
      user_id: userId,
      business_id: biz,
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

const salesUrl = (b: string) => `/v1/businesses/${b}/sales`;
const custUrl = (b: string) => `/v1/businesses/${b}/customers`;
const invUrl = (b: string) => `/v1/businesses/${b}/invoices`;

const invoiceIssued = (biz: string) =>
  prisma.outboxMessage
    .findMany({ where: { subject: SUBJECTS.sales.invoiceIssued } })
    .then((rs) =>
      rs
        .map((r) => (r.payload as { payload: Record<string, unknown> }).payload)
        .filter((p) => p.business_id === biz),
    );

async function seedProduct(
  biz: string,
  id: string,
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
        product_id: id,
        sku: `SKU-${id.slice(0, 6)}`,
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
        product_id: id,
        sell_price: price,
        winger_price: null,
        currency: 'TZS',
      },
    }),
  );
}

async function newCustomer(
  biz: string,
  name = 'Asha Traders',
): Promise<string> {
  const res = await http
    .post(custUrl(biz))
    .set(ctx(biz))
    .send({ name, email: 'asha@t.io' })
    .expect(201);
  return res.body.id;
}

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

  for (const b of [bizA, bizB]) {
    await businesses.onBusinessCreated(
      makeEnvelope({
        producer: 'tenancy',
        businessId: b,
        schemaVersion: '1.1.0',
        payload: {
          business_id: b,
          name: `Shop ${b.slice(0, 4)}`,
          currency: 'TZS',
          locale: 'sw',
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
  for (const b of [bizA, bizB]) {
    await prisma.runInTenantContext(b, async (tx) => {
      await tx.invoiceLine.deleteMany({});
      await tx.payment.deleteMany({});
      await tx.invoice.deleteMany({});
      await tx.saleLine.deleteMany({});
      await tx.receipt.deleteMany({});
      await tx.sale.deleteMany({});
      await tx.saleNumberCounter.deleteMany({});
      await tx.invoiceNumberCounter.deleteMany({});
      await tx.productCache.deleteMany({});
      await tx.customer.deleteMany({});
    });
  }
  await prisma.$executeRawUnsafe('DELETE FROM sales_business');
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await prisma.$executeRawUnsafe('DELETE FROM processed_events');
  await app.close();
});

describe('sales — credit sale → invoice issuance', () => {
  it('a credit sale issues one issued invoice with balance_due == total and a per-business number', async () => {
    const p = uuidv7();
    await seedProduct(bizA, p, 'Sukari 1kg', 2500);
    const customerId = await newCustomer(bizA);

    const res = await http
      .post(salesUrl(bizA))
      .set(ctx(bizA, 'staff', staffId))
      .send({
        lines: [{ product_id: p, quantity: 4 }],
        payment_terms: 'credit',
        customer_id: customerId,
      })
      .expect(201);

    expect(res.body.total).toBe(10000);
    expect(res.body.invoice).toMatchObject({
      number: 1,
      status: 'issued',
      balance_due_minor: 10000,
      public_token: expect.any(String),
    });

    const events = await invoiceIssued(bizA);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      invoice_id: res.body.invoice.id,
      sale_id: res.body.id,
      customer_id: customerId,
      customer_name: 'Asha Traders',
      customer_email: 'asha@t.io',
      number: 1,
      total_minor: 10000,
      balance_due_minor: 10000,
      locale: 'sw',
    });

    const cust = await http
      .get(`${custUrl(bizA)}/${customerId}`)
      .set(ctx(bizA))
      .expect(200);
    expect(cust.body.outstanding_balance).toBe(10000);

    // a second credit sale gets invoice number 2
    const res2 = await http
      .post(salesUrl(bizA))
      .set(ctx(bizA))
      .send({
        lines: [{ product_id: p, quantity: 1 }],
        payment_terms: 'credit',
        customer_id: customerId,
      })
      .expect(201);
    expect(res2.body.invoice.number).toBe(2);
  });

  it('a credit sale with no customer_id → 400 customer_required', async () => {
    const p = uuidv7();
    await seedProduct(bizA, p, 'Mchele', 4000);
    const res = await http
      .post(salesUrl(bizA))
      .set(ctx(bizA))
      .send({
        lines: [{ product_id: p, quantity: 1 }],
        payment_terms: 'credit',
      })
      .expect(400);
    expect(res.body.error.code).toBe('customer_required');
  });

  it('a credit sale with an unknown customer_id → 400, no sale and no invoice written', async () => {
    const p = uuidv7();
    await seedProduct(bizB, p, 'Chumvi', 1000);
    const before = await prisma.runInTenantContext(bizB, (tx) =>
      tx.sale.count(),
    );

    const res = await http
      .post(salesUrl(bizB))
      .set(ctx(bizB))
      .send({
        lines: [{ product_id: p, quantity: 1 }],
        payment_terms: 'credit',
        customer_id: uuidv7(),
      })
      .expect(400);
    expect(res.body.error.code).toBe('validation_error');

    const after = await prisma.runInTenantContext(bizB, (tx) =>
      tx.sale.count(),
    );
    expect(after).toBe(before);
    expect(
      await prisma.runInTenantContext(bizB, (tx) => tx.invoice.count()),
    ).toBe(0);
    expect(inv.releaseReservation).toHaveBeenCalledTimes(1);
  });

  it('a cash sale issues no invoice and no InvoiceIssued', async () => {
    const p = uuidv7();
    await seedProduct(bizB, p, 'Unga', 3000);
    const res = await http
      .post(salesUrl(bizB))
      .set(ctx(bizB))
      .send({ lines: [{ product_id: p, quantity: 2 }] })
      .expect(201);
    expect(res.body.invoice).toBeNull();
    expect(await invoiceIssued(bizB)).toHaveLength(0);
  });

  it('a reservation shortfall on a credit sale leaves no sale, no invoice, no event', async () => {
    const p = uuidv7();
    await seedProduct(bizB, p, 'Juice', 1500);
    const customerId = await newCustomer(bizB, 'Bakari');
    inv.reserveStock.mockResolvedValueOnce({
      ok: false,
      shortfalls: [{ product_id: p, available: 0 }],
    } as never);

    const before = await prisma.runInTenantContext(bizB, (tx) =>
      tx.sale.count(),
    );
    await http
      .post(salesUrl(bizB))
      .set(ctx(bizB))
      .send({
        lines: [{ product_id: p, quantity: 5 }],
        payment_terms: 'credit',
        customer_id: customerId,
      })
      .expect(422);

    expect(await prisma.runInTenantContext(bizB, (tx) => tx.sale.count())).toBe(
      before,
    );
    const cust = await http
      .get(`${custUrl(bizB)}/${customerId}`)
      .set(ctx(bizB))
      .expect(200);
    expect(cust.body.outstanding_balance).toBe(0);
  });

  it('GET /v1/i/{token} is public, whitelisted, and 404s for an unknown token', async () => {
    const p = uuidv7();
    await seedProduct(bizA, p, 'Soap', 1200);
    const customerId = await newCustomer(bizA, 'Chausiku');
    const sale = await http
      .post(salesUrl(bizA))
      .set(ctx(bizA))
      .send({
        lines: [{ product_id: p, quantity: 3 }],
        payment_terms: 'credit',
        customer_id: customerId,
      })
      .expect(201);
    const token = sale.body.invoice.public_token;

    const pub = await http.get(`/v1/i/${token}`).expect(200); // no auth headers
    expect(Object.keys(pub.body).sort()).toEqual(
      [
        'amount_paid_minor',
        'balance_due_minor',
        'business_name',
        'currency',
        'customer_name',
        'discount_minor',
        'due_date',
        'issue_date',
        'lines',
        'number',
        'status',
        'subtotal_minor',
        'tax_minor',
        'total_minor',
      ].sort(),
    );
    expect(pub.body).toMatchObject({
      business_name: expect.any(String),
      customer_name: 'Chausiku',
      total_minor: 3600,
      balance_due_minor: 3600,
      status: 'issued',
    });
    expect(pub.body.lines[0]).not.toHaveProperty('product_id');

    await http.get(`/v1/i/${'nope-' + uuidv7()}`).expect(404);
  });

  it('invoice list + get: Owner sees all; ?status= filters; Staff cannot read another user’s invoice', async () => {
    const list = await http
      .get(`${invUrl(bizA)}?status=issued`)
      .set(ctx(bizA))
      .expect(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(
      list.body.data.every((i: { status: string }) => i.status === 'issued'),
    ).toBe(true);
    const anId = list.body.data[0].id;

    await http
      .get(`${invUrl(bizA)}/${anId}`)
      .set(ctx(bizA))
      .expect(200);
    // a Staff member who rang up none of these credit sales → 404
    await http
      .get(`${invUrl(bizA)}/${anId}`)
      .set(ctx(bizA, 'staff', uuidv7()))
      .expect(404);
  });

  it('concurrent credit sales never collide on the invoice number', async () => {
    const p = uuidv7();
    await seedProduct(bizB, p, 'Bulk', 100);
    const customerId = await newCustomer(bizB, 'Concurrent Co');

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        sales.createSale(bizB, staffId, {
          lines: [{ product_id: p, quantity: 1 }],
          payment_terms: 'credit',
          customer_id: customerId,
        }),
      ),
    );
    const numbers = results.map((r) => r.invoice!.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(10);
  });
});
