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
import { OutboxRelayService } from '../src/platform/outbox-relay.service.js';
import { BusinessCreatedConsumer } from '../src/consumers/business-created.consumer.js';

let app: INestApplication;
let prisma: PrismaService;
let bus: InMemoryBus;
let relay: OutboxRelayService;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
const ownerId = uuidv7();
const staffId = uuidv7();

type Kind = 'user' | 'operator';
function ctx(opts: {
  businessId: string | null;
  userId?: string | null;
  role?: 'owner' | 'staff' | null;
  kind?: Kind;
}): Record<string, string> {
  const { header, signature } = signInternalContext(
    {
      request_id: `test-${uuidv7()}`,
      user_id: opts.userId === undefined ? ownerId : opts.userId,
      business_id: opts.businessId,
      role: opts.role ?? (opts.kind === 'operator' ? null : 'owner'),
      token_kind: opts.kind ?? 'user',
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

const ownerA = () => ctx({ businessId: bizA, userId: ownerId, role: 'owner' });
const staffA = () => ctx({ businessId: bizA, userId: staffId, role: 'staff' });

beforeAll(async () => {
  bus = new InMemoryBus();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(bus)
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);

  prisma = app.get(PrismaService);
  relay = app.get(OutboxRelayService);
  http = request(app.getHttpServer());
});

afterAll(async () => {
  for (const b of [bizA, bizB]) {
    await prisma.runInTenantContext(b, async (tx) => {
      await tx.product.deleteMany({});
      await tx.category.deleteMany({});
    });
  }
  await prisma.$executeRawUnsafe(`DELETE FROM outbox`);
  await prisma.$executeRawUnsafe(`DELETE FROM processed_events`);
  await app.close();
});

describe('catalog — products & role-aware DTO', () => {
  let productId = '';

  it('owner creates a product with prices; list + get expose cost_price', async () => {
    const created = await http
      .post(`/v1/businesses/${bizA}/products`)
      .set(ownerA())
      .send({
        sku: 'SODA-300',
        name: 'Cola 300ml',
        code: 'CODE-COLA',
        cost_price: 800,
        sell_price: 1500,
        winger_price: 1300,
        reorder_threshold: 6,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      sku: 'SODA-300',
      sell_price: 1500,
      winger_price: 1300,
      cost_price: 800,
      is_active: true,
    });
    productId = created.body.id;

    const list = await http
      .get(`/v1/businesses/${bizA}/products`)
      .set(ownerA())
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body).toHaveProperty('next_cursor', null);

    const got = await http
      .get(`/v1/businesses/${bizA}/products/${productId}`)
      .set(ownerA())
      .expect(200);
    expect(got.body.cost_price).toBe(800);
  });

  it('staff never sees cost_price and cannot set price fields', async () => {
    const got = await http
      .get(`/v1/businesses/${bizA}/products/${productId}`)
      .set(staffA())
      .expect(200);
    expect(got.body).not.toHaveProperty('cost_price');
    expect(got.body.sell_price).toBe(1500);

    const created = await http
      .post(`/v1/businesses/${bizA}/products`)
      .set(staffA())
      .send({
        sku: 'STAFF-1',
        name: 'Staff priced',
        cost_price: 999,
        sell_price: 999,
      })
      .expect(201);
    expect(created.body).not.toHaveProperty('cost_price');
    expect(created.body.sell_price).toBe(0);
  });

  it('scan: known code returns the product, unknown code is 404 echoing the code', async () => {
    const hit = await http
      .get(`/v1/businesses/${bizA}/products`)
      .query({ code: 'CODE-COLA' })
      .set(ownerA())
      .expect(200);
    expect(hit.body.data).toHaveLength(1);
    expect(hit.body.data[0].id).toBe(productId);

    const miss = await http
      .get(`/v1/businesses/${bizA}/products`)
      .query({ code: 'GHOST-CODE' })
      .set(ownerA())
      .expect(404);
    expect(miss.body.error.code).toBe('not_found');
    expect(miss.body.error.details).toContainEqual({
      field: 'code',
      issue: 'GHOST-CODE',
    });
  });

  it('duplicate SKU is a 409 conflict', async () => {
    const dup = await http
      .post(`/v1/businesses/${bizA}/products`)
      .set(ownerA())
      .send({ sku: 'SODA-300', name: 'Dupe' })
      .expect(409);
    expect(dup.body.error.code).toBe('conflict');
  });

  it('deactivate flips is_active and is idempotent', async () => {
    const off = await http
      .post(`/v1/businesses/${bizA}/products/${productId}/deactivate`)
      .set(ownerA())
      .expect(201);
    expect(off.body.is_active).toBe(false);
    await http
      .post(`/v1/businesses/${bizA}/products/${productId}/deactivate`)
      .set(ownerA())
      .expect(201);
  });

  it('rejects an operator context with operator_data_access_denied', async () => {
    const res = await http
      .get(`/v1/businesses/${bizA}/products`)
      .set(ctx({ businessId: bizA, userId: null, kind: 'operator' }))
      .expect(403);
    expect(res.body.error.code).toBe('operator_data_access_denied');
  });

  it('rejects a context whose business_id does not match the path', async () => {
    const res = await http
      .get(`/v1/businesses/${bizA}/products`)
      .set(ctx({ businessId: bizB, userId: ownerId, role: 'owner' }))
      .expect(403);
    expect(res.body.error.code).toBe('not_a_member');
  });

  it('tenant isolation: business B sees none of business A products', async () => {
    const res = await http
      .get(`/v1/businesses/${bizB}/products`)
      .set(ctx({ businessId: bizB, userId: ownerId, role: 'owner' }))
      .expect(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('catalog — categories', () => {
  it('creates a category and rejects a duplicate name with 409', async () => {
    await http
      .post(`/v1/businesses/${bizA}/categories`)
      .set(ownerA())
      .send({ name: 'Beverages' })
      .expect(201);
    const dup = await http
      .post(`/v1/businesses/${bizA}/categories`)
      .set(ownerA())
      .send({ name: 'Beverages' })
      .expect(409);
    expect(dup.body.error.code).toBe('conflict');

    const list = await http
      .get(`/v1/businesses/${bizA}/categories`)
      .set(staffA())
      .expect(200);
    expect(list.body.map((c: { name: string }) => c.name)).toContain(
      'Beverages',
    );
  });
});

describe('catalog — outbox events', () => {
  it('a product write enqueues ProductUpserted + PriceChanged; the relay publishes them', async () => {
    const { body: product } = await http
      .post(`/v1/businesses/${bizA}/products`)
      .set(ownerA())
      .send({ sku: 'EVT-1', name: 'Event product', sell_price: 2000 })
      .expect(201);

    const rows = await prisma.$queryRawUnsafe<{ subject: string }[]>(
      `SELECT subject FROM outbox WHERE payload->'payload'->>'product_id' = $1`,
      product.id,
    );
    const subjects = rows.map((r) => r.subject);
    expect(subjects).toContain(SUBJECTS.catalog.productUpserted);
    expect(subjects).toContain(SUBJECTS.catalog.priceChanged);

    const published = await relay.tick();
    expect(published).toBeGreaterThanOrEqual(2);
    const evt = bus.publishes.find(
      (p) =>
        p.subject === SUBJECTS.catalog.productUpserted &&
        (p.data as { payload: { product_id: string } }).payload.product_id ===
          product.id,
    );
    expect(evt).toBeDefined();
  });
});

describe('catalog — BusinessCreated consumer', () => {
  it('is idempotent on event_id (same event twice → one processed row)', async () => {
    const consumer = app.get(BusinessCreatedConsumer);
    const evt = makeEnvelope({
      producer: 'tenancy',
      businessId: bizA,
      schemaVersion: '1.0.0',
      payload: {
        business_id: bizA,
        name: 'Duka',
        currency: 'TZS',
        locale: 'en',
        owner_user_id: ownerId,
      },
    });

    await consumer.handle(evt);
    await consumer.handle(evt);

    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM processed_events WHERE event_id = $1::uuid`,
      evt.event_id,
    );
    expect(Number(rows[0].n)).toBe(1);
  });
});
