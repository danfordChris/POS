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
const bizC = uuidv7();
const userId = uuidv7();

function ctx(
  businessId: string | null,
  role: 'owner' | 'staff' | null = 'owner',
  kind: 'user' | 'operator' = 'user',
) {
  const { header, signature } = signInternalContext(
    {
      request_id: `t-${uuidv7()}`,
      user_id: kind === 'operator' ? null : userId,
      business_id: businessId,
      role: kind === 'operator' ? null : role,
      token_kind: kind,
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

const urlA = `/v1/businesses/${bizA}/alert-config`;
const urlB = `/v1/businesses/${bizB}/alert-config`;

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
  for (const b of [bizA, bizB, bizC]) {
    await prisma.runInTenantContext(b, async (tx) => {
      await tx.alertConfig.deleteMany({});
    });
  }
  await prisma.$executeRawUnsafe(`DELETE FROM outbox`);
  await app.close();
});

describe('inventory — alert-config', () => {
  it('GET lazily creates and returns the per-business default for an Owner', async () => {
    const res = await http.get(urlA).set(ctx(bizA, 'owner')).expect(200);
    expect(res.body).toMatchObject({ recipients: [], min_interval_hours: 24 });
    expect(typeof res.body.updated_at).toBe('string');

    // Persisted: a second GET is identical and one row now exists.
    const again = await http.get(urlA).set(ctx(bizA, 'owner')).expect(200);
    expect(again.body).toEqual(res.body);
    const rows = await prisma.runInTenantContext(bizA, (tx) =>
      tx.alertConfig.findMany({}),
    );
    expect(rows).toHaveLength(1);
  });

  it('PUT saves recipients + interval and GET reads them back', async () => {
    const put = await http
      .put(urlA)
      .set(ctx(bizA, 'owner'))
      .send({ recipients: ['a@b.com'], min_interval_hours: 6 })
      .expect(200);
    expect(put.body).toMatchObject({
      recipients: ['a@b.com'],
      min_interval_hours: 6,
    });

    const get = await http.get(urlA).set(ctx(bizA, 'owner')).expect(200);
    expect(get.body).toMatchObject({
      recipients: ['a@b.com'],
      min_interval_hours: 6,
    });
  });

  it('PUT emits AlertConfigChanged on the outbox', async () => {
    await http
      .put(`/v1/businesses/${bizC}/alert-config`)
      .set(ctx(bizC, 'owner'))
      .send({ recipients: ['x@y.com'], min_interval_hours: 3 })
      .expect(200);

    const rows = await prisma.outboxMessage.findMany({
      where: { subject: SUBJECTS.inventory.alertConfigChanged },
    });
    const mine = rows
      .map((r) => (r.payload as { payload: Record<string, unknown> }).payload)
      .filter((p) => p.business_id === bizC);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      business_id: bizC,
      min_interval_hours: 3,
      recipients: ['x@y.com'],
    });
  });

  it('rejects Staff on GET and PUT with role_forbidden', async () => {
    const g = await http.get(urlA).set(ctx(bizA, 'staff')).expect(403);
    expect(g.body.error.code).toBe('role_forbidden');
    const p = await http
      .put(urlA)
      .set(ctx(bizA, 'staff'))
      .send({ recipients: [], min_interval_hours: 12 })
      .expect(403);
    expect(p.body.error.code).toBe('role_forbidden');
  });

  it('rejects a context whose business does not match the path with not_a_member', async () => {
    const res = await http
      .get(`/v1/businesses/${uuidv7()}/alert-config`)
      .set(ctx(bizA, 'owner'))
      .expect(403);
    expect(res.body.error.code).toBe('not_a_member');
  });

  it('rejects an operator context', async () => {
    const res = await http
      .get(urlA)
      .set(ctx(bizA, null, 'operator'))
      .expect(403);
    expect(res.body.error.code).toBe('operator_data_access_denied');
  });

  it('400 validation_error on min_interval_hours < 1 or a bad recipient', async () => {
    const lo = await http
      .put(urlA)
      .set(ctx(bizA, 'owner'))
      .send({ recipients: [], min_interval_hours: 0 })
      .expect(400);
    expect(lo.body.error.code).toBe('validation_error');

    const bad = await http
      .put(urlA)
      .set(ctx(bizA, 'owner'))
      .send({ recipients: ['not-an-email'], min_interval_hours: 24 })
      .expect(400);
    expect(bad.body.error.code).toBe('validation_error');
  });

  it('tenant isolation: business B never sees business A recipients', async () => {
    const res = await http.get(urlB).set(ctx(bizB, 'owner')).expect(200);
    expect(res.body.recipients).toEqual([]);
    expect(res.body.recipients).not.toContain('a@b.com');
  });
});
