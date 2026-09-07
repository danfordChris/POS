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
const biz = uuidv7();
const ownerId = uuidv7();
const staffId = uuidv7();

const inv = {
  reserveStock: vi.fn(async () => ({ ok: true as const })),
  commitReservation: vi.fn(async () => ({ ok: true })),
  releaseReservation: vi.fn(async () => ({ ok: true })),
};

function ctx(role: 'owner' | 'staff' = 'owner', userId = ownerId) {
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

const salesUrl = `/v1/businesses/${biz}/sales`;
const custUrl = `/v1/businesses/${biz}/customers`;
const invUrl = `/v1/businesses/${biz}/invoices`;

const events = (subject: string) =>
  prisma.outboxMessage
    .findMany({ where: { subject } })
    .then((rs) =>
      rs
        .map((r) => (r.payload as { payload: Record<string, unknown> }).payload)
        .filter((p) => p.business_id === biz),
    );

async function seedProduct(id: string, name: string, price: number) {
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

async function newCustomer(name = 'Asha Traders'): Promise<string> {
  const res = await http
    .post(custUrl)
    .set(ctx())
    .send({ name, email: 'asha@t.io' })
    .expect(201);
  return res.body.id;
}

async function balance(customerId: string): Promise<number> {
  const res = await http.get(`${custUrl}/${customerId}`).set(ctx()).expect(200);
  return res.body.outstanding_balance;
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

  await businesses.onBusinessCreated(
    makeEnvelope({
      producer: 'tenancy',
      businessId: biz,
      schemaVersion: '1.1.0',
      payload: {
        business_id: biz,
        name: 'Duka',
        currency: 'TZS',
        locale: 'en',
        owner_user_id: uuidv7(),
      },
    }),
  );
});

afterEach(() => {
  inv.reserveStock.mockClear();
  inv.reserveStock.mockResolvedValue({ ok: true } as never);
});

afterAll(async () => {
  await prisma.runInTenantContext(biz, async (tx) => {
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
  await prisma.$executeRawUnsafe('DELETE FROM sales_business');
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await prisma.$executeRawUnsafe('DELETE FROM processed_events');
  await app.close();
});

describe('sales — standalone invoices + payments + void', () => {
  it('raises a standalone invoice from explicit lines (no stock movement) and bumps the customer balance', async () => {
    const customerId = await newCustomer();
    const res = await http
      .post(invUrl)
      .set(ctx('staff', staffId))
      .send({
        customer_id: customerId,
        lines: [
          { description: 'Consulting', quantity: 2, unit_price_minor: 5000 },
          {
            description: 'Delivery',
            quantity: 1,
            unit_price_minor: 2000,
            discount_minor: 500,
          },
        ],
      })
      .expect(201);

    expect(res.body).toMatchObject({
      number: 1,
      status: 'issued',
      subtotal_minor: 12000,
      discount_minor: 500,
      total_minor: 11500,
      balance_due_minor: 11500,
      sale_id: null,
    });
    expect(res.body.lines).toHaveLength(2);
    expect(await balance(customerId)).toBe(11500);
    expect(await events(SUBJECTS.sales.invoiceIssued)).toHaveLength(1);
    // no sale artifacts
    expect(await prisma.runInTenantContext(biz, (tx) => tx.sale.count())).toBe(
      0,
    );
  });

  it('raises an invoice from a completed cash sale via sale_id; a second attempt → 409; both sale_id+lines → 400', async () => {
    const p = uuidv7();
    await seedProduct(p, 'Sukari', 2500);
    const customerId = await newCustomer('Bakari');
    const sale = await http
      .post(salesUrl)
      .set(ctx())
      .send({ lines: [{ product_id: p, quantity: 3 }] })
      .expect(201);

    const inv1 = await http
      .post(invUrl)
      .set(ctx())
      .send({ customer_id: customerId, sale_id: sale.body.id })
      .expect(201);
    expect(inv1.body).toMatchObject({
      sale_id: sale.body.id,
      total_minor: 7500,
      balance_due_minor: 7500,
    });
    expect(inv1.body.lines[0].description).toBe('Sukari');

    await http
      .post(invUrl)
      .set(ctx())
      .send({ customer_id: customerId, sale_id: sale.body.id })
      .expect(409);

    const bad = await http
      .post(invUrl)
      .set(ctx())
      .send({
        customer_id: customerId,
        sale_id: uuidv7(),
        lines: [{ description: 'x', quantity: 1, unit_price_minor: 1 }],
      })
      .expect(400);
    expect(bad.body.error.code).toBe('validation_error');
  });

  it('records partial then final payments: partially_paid → paid; customer balance tracks; a payment on a paid invoice → 409', async () => {
    const customerId = await newCustomer('Chausiku');
    const inv1 = await http
      .post(invUrl)
      .set(ctx())
      .send({
        customer_id: customerId,
        lines: [{ description: 'Job', quantity: 1, unit_price_minor: 10000 }],
      })
      .expect(201);
    const id = inv1.body.id;

    const p1 = await http
      .post(`${invUrl}/${id}/payments`)
      .set(ctx())
      .send({ amount_minor: 4000, method: 'cash' })
      .expect(201);
    expect(p1.body).toMatchObject({
      status: 'partially_paid',
      amount_paid_minor: 4000,
      balance_due_minor: 6000,
    });
    expect(await balance(customerId)).toBe(6000);

    const p2 = await http
      .post(`${invUrl}/${id}/payments`)
      .set(ctx())
      .send({
        amount_minor: 6000,
        method: 'mobile_money',
        reference: 'MPESA123',
      })
      .expect(201);
    expect(p2.body).toMatchObject({
      status: 'paid',
      amount_paid_minor: 10000,
      balance_due_minor: 0,
    });
    expect(p2.body.payments).toHaveLength(2);
    expect(await balance(customerId)).toBe(0);

    const paidEvents = (
      await events(SUBJECTS.sales.invoicePaymentRecorded)
    ).filter((e) => e.invoice_id === id);
    expect(paidEvents).toHaveLength(2);
    expect(paidEvents[1]).toMatchObject({
      paid_in_full: true,
      balance_due_minor: 0,
    });

    await http
      .post(`${invUrl}/${id}/payments`)
      .set(ctx())
      .send({ amount_minor: 1, method: 'cash' })
      .expect(409);
  });

  it('rejects an overpayment with 422 and records nothing', async () => {
    const customerId = await newCustomer('Dawa');
    const inv1 = await http
      .post(invUrl)
      .set(ctx())
      .send({
        customer_id: customerId,
        lines: [{ description: 'Job', quantity: 1, unit_price_minor: 3000 }],
      })
      .expect(201);
    const id = inv1.body.id;

    const res = await http
      .post(`${invUrl}/${id}/payments`)
      .set(ctx())
      .send({ amount_minor: 3001, method: 'cash' })
      .expect(422);
    expect(res.body.error.code).toBe('overpayment');

    const after = await http.get(`${invUrl}/${id}`).set(ctx()).expect(200);
    expect(after.body).toMatchObject({
      status: 'issued',
      amount_paid_minor: 0,
      balance_due_minor: 3000,
    });
    expect(after.body.payments).toHaveLength(0);
  });

  it('is idempotent on Idempotency-Key: a replay records one payment', async () => {
    const customerId = await newCustomer('Echo');
    const inv1 = await http
      .post(invUrl)
      .set(ctx())
      .send({
        customer_id: customerId,
        lines: [{ description: 'Job', quantity: 1, unit_price_minor: 5000 }],
      })
      .expect(201);
    const id = inv1.body.id;
    const key = `pay-${uuidv7()}`;

    const a = await http
      .post(`${invUrl}/${id}/payments`)
      .set(ctx())
      .set('Idempotency-Key', key)
      .send({ amount_minor: 2000, method: 'cash' })
      .expect(201);
    const b = await http
      .post(`${invUrl}/${id}/payments`)
      .set(ctx())
      .set('Idempotency-Key', key)
      .send({ amount_minor: 2000, method: 'cash' })
      .expect(201);
    expect(b.body.amount_paid_minor).toBe(2000);
    expect(a.body.payments).toHaveLength(1);
    expect(b.body.payments).toHaveLength(1);
  });

  it('Owner voids an invoice: void + zero balance, payments retained, customer balance drops, InvoiceVoided; Staff → 403; a paid invoice → 409', async () => {
    const customerId = await newCustomer('Faraja');
    const inv1 = await http
      .post(invUrl)
      .set(ctx())
      .send({
        customer_id: customerId,
        lines: [{ description: 'Job', quantity: 1, unit_price_minor: 8000 }],
      })
      .expect(201);
    const id = inv1.body.id;
    await http
      .post(`${invUrl}/${id}/payments`)
      .set(ctx())
      .send({ amount_minor: 3000, method: 'cash' })
      .expect(201);
    expect(await balance(customerId)).toBe(5000);

    await http
      .post(`${invUrl}/${id}/void`)
      .set(ctx('staff', staffId))
      .send({})
      .expect(403);

    const voided = await http
      .post(`${invUrl}/${id}/void`)
      .set(ctx())
      .send({ reason: 'entered twice' })
      .expect(200);
    expect(voided.body).toMatchObject({
      status: 'void',
      balance_due_minor: 0,
      void_reason: 'entered twice',
    });
    expect(voided.body.payments).toHaveLength(1); // retained
    expect(await balance(customerId)).toBe(0);
    expect(
      (await events(SUBJECTS.sales.invoiceVoided)).filter(
        (e) => e.invoice_id === id,
      ),
    ).toHaveLength(1);

    // a fully-paid invoice cannot be voided
    const c2 = await newCustomer('Gani');
    const inv2 = await http
      .post(invUrl)
      .set(ctx())
      .send({
        customer_id: c2,
        lines: [{ description: 'x', quantity: 1, unit_price_minor: 1000 }],
      })
      .expect(201);
    await http
      .post(`${invUrl}/${inv2.body.id}/payments`)
      .set(ctx())
      .send({ amount_minor: 1000, method: 'cash' })
      .expect(201);
    const r = await http
      .post(`${invUrl}/${inv2.body.id}/void`)
      .set(ctx())
      .send({})
      .expect(409);
    expect(r.body.error.code).toBe('invoice_not_payable');
  });

  it('voiding a credit sale voids its invoice and restores the customer balance', async () => {
    const p = uuidv7();
    await seedProduct(p, 'Unga', 4000);
    const customerId = await newCustomer('Halima');
    const sale = await http
      .post(salesUrl)
      .set(ctx())
      .send({
        lines: [{ product_id: p, quantity: 2 }],
        payment_terms: 'credit',
        customer_id: customerId,
      })
      .expect(201);
    expect(await balance(customerId)).toBe(8000);
    const invoiceId = sale.body.invoice.id;

    await http
      .post(`${salesUrl}/${sale.body.id}/void`)
      .set(ctx())
      .send()
      .expect(200);

    const inv1 = await http
      .get(`${invUrl}/${invoiceId}`)
      .set(ctx())
      .expect(200);
    expect(inv1.body.status).toBe('void');
    expect(await balance(customerId)).toBe(0);
    expect(
      (await events(SUBJECTS.sales.invoiceVoided)).filter(
        (e) => e.invoice_id === invoiceId,
      ),
    ).toHaveLength(1);
    // stock reversal path still fires
    expect(
      (await events(SUBJECTS.sales.saleVoided)).filter(
        (e) => e.sale_id === sale.body.id,
      ),
    ).toHaveLength(1);
  });

  it('keeps the balance invariant across a random payment sequence', async () => {
    const customerId = await newCustomer('Imani');
    const total = 10000;
    const inv1 = await http
      .post(invUrl)
      .set(ctx())
      .send({
        customer_id: customerId,
        lines: [{ description: 'Job', quantity: 1, unit_price_minor: total }],
      })
      .expect(201);
    const id = inv1.body.id;

    const chunks = [1500, 2500, 1000, 3000, 2000]; // sums to 10000
    let paid = 0;
    for (const amt of chunks) {
      const res = await http
        .post(`${invUrl}/${id}/payments`)
        .set(ctx())
        .send({ amount_minor: amt, method: 'bank_transfer' })
        .expect(201);
      paid += amt;
      expect(res.body.amount_paid_minor).toBe(paid);
      expect(res.body.balance_due_minor).toBe(total - paid);
      expect(res.body.status).toBe(paid === total ? 'paid' : 'partially_paid');
    }
    expect(await balance(customerId)).toBe(0);
  });
});
