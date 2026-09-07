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
import { SUBJECTS } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
const ownerId = uuidv7();
const staffId = uuidv7();

function ctx(
  businessId: string,
  role: 'owner' | 'staff' = 'owner',
  userId: string = ownerId,
  tokenKind: 'user' | 'operator' = 'user',
) {
  const { header, signature } = signInternalContext(
    {
      request_id: `t-${uuidv7()}`,
      user_id: userId,
      business_id: businessId,
      role,
      token_kind: tokenKind,
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

const url = (biz: string) => `/v1/businesses/${biz}/customers`;

const customerEvents = (subject: string, biz: string) =>
  prisma.outboxMessage
    .findMany({ where: { subject } })
    .then((rs) =>
      rs
        .map((r) => (r.payload as { payload: Record<string, unknown> }).payload)
        .filter((p) => p.business_id === biz),
    );

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
  http = request(app.getHttpServer());
});

afterAll(async () => {
  for (const b of [bizA, bizB]) {
    await prisma.runInTenantContext(b, async (tx) => {
      await tx.customer.deleteMany({});
    });
  }
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await app.close();
});

describe('sales — customers CRUD + AR rollup', () => {
  let ashaId = '';

  it('creates a customer → 201, persists it, publishes one CustomerCreated', async () => {
    const res = await http
      .post(url(bizA))
      .set(ctx(bizA, 'staff', staffId))
      .send({
        name: '  Asha Traders  ',
        email: 'ASHA@example.com',
        phone: '+255700000001',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Asha Traders',
      email: 'asha@example.com',
      phone: '+255700000001',
      outstanding_balance: 0,
      disabled: false,
    });
    ashaId = res.body.id;

    const events = await customerEvents(SUBJECTS.sales.customerCreated, bizA);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      customer_id: ashaId,
      name: 'Asha Traders',
      email: 'asha@example.com',
    });
  });

  it('rejects a customer with no name → 400 validation_error', async () => {
    const res = await http
      .post(url(bizA))
      .set(ctx(bizA))
      .send({ phone: '123' })
      .expect(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('lists customers newest-first; ?q= filters; ?has_balance=true is empty with no invoices', async () => {
    await http
      .post(url(bizA))
      .set(ctx(bizA))
      .send({ name: 'Bakari Wholesale' })
      .expect(201);

    const all = await http.get(url(bizA)).set(ctx(bizA)).expect(200);
    expect(all.body.data.map((c: { name: string }) => c.name)).toEqual([
      'Bakari Wholesale',
      'Asha Traders',
    ]);

    const q = await http
      .get(`${url(bizA)}?q=asha`)
      .set(ctx(bizA))
      .expect(200);
    expect(q.body.data).toHaveLength(1);
    expect(q.body.data[0].name).toBe('Asha Traders');

    const withBalance = await http
      .get(`${url(bizA)}?has_balance=true`)
      .set(ctx(bizA))
      .expect(200);
    expect(withBalance.body.data).toEqual([]);
  });

  it('gets a customer by id with a zero balance + empty recent_invoices; unknown id → 404', async () => {
    const res = await http
      .get(`${url(bizA)}/${ashaId}`)
      .set(ctx(bizA))
      .expect(200);
    expect(res.body).toMatchObject({
      id: ashaId,
      outstanding_balance: 0,
      recent_invoices: [],
    });

    const missing = await http
      .get(`${url(bizA)}/${uuidv7()}`)
      .set(ctx(bizA))
      .expect(404);
    expect(missing.body.error.code).toBe('not_found');
  });

  it('PATCH disabled:true hides the customer from the default list but keeps it fetchable', async () => {
    await http
      .patch(`${url(bizA)}/${ashaId}`)
      .set(ctx(bizA))
      .send({ disabled: true })
      .expect(200);

    const list = await http.get(url(bizA)).set(ctx(bizA)).expect(200);
    expect(list.body.data.map((c: { id: string }) => c.id)).not.toContain(
      ashaId,
    );

    const still = await http
      .get(`${url(bizA)}/${ashaId}`)
      .set(ctx(bizA))
      .expect(200);
    expect(still.body).toMatchObject({ id: ashaId, disabled: true });

    const events = await customerEvents(SUBJECTS.sales.customerUpdated, bizA);
    expect(events.at(-1)).toMatchObject({
      customer_id: ashaId,
      disabled: true,
    });
  });

  it('is business-scoped: bizB sees none of bizA customers (forced RLS)', async () => {
    const res = await http.get(url(bizB)).set(ctx(bizB)).expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('rejects an operator token (403) and a wrong-business context (403)', async () => {
    const op = await http
      .get(url(bizA))
      .set(ctx(bizA, 'owner', ownerId, 'operator'))
      .expect(403);
    expect(op.body.error.code).toBe('operator_data_access_denied');

    // context signed for bizB, path is bizA
    const cross = await http.get(url(bizA)).set(ctx(bizB)).expect(403);
    expect(cross.body.error.code).toBe('not_a_member');
  });
});
