import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import {
  configureApp,
  registerNotFoundFallback,
  MESSAGE_BUS,
  signInternalContext,
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_CONTEXT_SIGNATURE_HEADER,
} from '@pos/nest-common';
import { SUBJECTS } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

const SECRET = process.env.INTERNAL_CONTEXT_SECRET as string;

function ctx(opts: {
  userId?: string | null;
  businessId?: string | null;
  role?: 'owner' | 'staff' | null;
  kind?: 'user' | 'operator';
}): Record<string, string> {
  const { header, signature } = signInternalContext(
    {
      request_id: randomUUID(),
      user_id: opts.userId ?? null,
      business_id: opts.businessId ?? null,
      role: opts.role ?? null,
      token_kind: opts.kind ?? 'user',
    },
    SECRET,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

beforeAll(async () => {
  const bus = new InMemoryBus();
  await bus.reply(SUBJECTS.identity.getUser, async (raw) => {
    const q = raw as { email?: string; user_id?: string; create?: boolean };
    return {
      found: true,
      user_id: q.user_id ?? randomUUID(),
      name: 'Owner',
      email: q.email ?? 'owner@example.com',
      phone: null,
      disabled: false,
      locale: 'en',
    };
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(bus)
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);

  prisma = app.get(PrismaService);
  http = request(app.getHttpServer());
});

afterAll(async () => {
  await app.close();
});

/** A provisioned business + a separate Owner user for the tenant side. */
async function provisionBusiness(): Promise<{ id: string; owner: string }> {
  const operator = randomUUID();
  const res = await http
    .post('/v1/admin/businesses')
    .set(ctx({ userId: operator, kind: 'operator' }))
    .send({
      name: 'CP Store',
      owner_email: `owner-${randomUUID().slice(0, 8)}@example.com`,
    })
    .expect(201);
  const id = res.body.id as string;
  // Find the owner user the provision flow created.
  const membership = await prisma.runInTenantContext(id, (tx) =>
    tx.membership.findFirst({ where: { businessId: id, role: 'owner' } }),
  );
  return { id, owner: membership!.userId };
}

describe('tenancy — control-plane + break-glass', () => {
  it('a user token is rejected on /v1/admin/*', async () => {
    await http
      .get('/v1/admin/businesses')
      .set(ctx({ userId: randomUUID(), kind: 'user' }))
      .expect(403);
  });

  it('operator provisions a business + first owner; list shows counts, not contents', async () => {
    const { id } = await provisionBusiness();
    const list = await http
      .get('/v1/admin/businesses')
      .set(ctx({ userId: randomUUID(), kind: 'operator' }))
      .expect(200);
    const row = list.body.find((b: { id: string }) => b.id === id);
    expect(row).toMatchObject({
      subscription_status: expect.any(String),
      member_count: 1,
    });
    expect(row.members).toBeUndefined();
  });

  it('operator sets subscription_status', async () => {
    const { id } = await provisionBusiness();
    const res = await http
      .patch(`/v1/admin/businesses/${id}`)
      .set(ctx({ userId: randomUUID(), kind: 'operator' }))
      .send({ subscription_status: 'suspended' })
      .expect(200);
    expect(res.body.subscription_status).toBe('suspended');
  });

  it('grant lifecycle: no grant → 403; request → approve (24h cap) → detail + audit; revoke → 403', async () => {
    const { id, owner } = await provisionBusiness();
    const operator = randomUUID();

    // No grant → detail denied.
    const denied = await http
      .get(`/v1/admin/businesses/${id}/detail`)
      .set(ctx({ userId: operator, kind: 'operator' }))
      .expect(403);
    expect(denied.body.error.code).toBe('operator_data_access_denied');

    // Operator requests break-glass.
    const grant = await http
      .post('/v1/admin/support-grants')
      .set(ctx({ userId: operator, kind: 'operator' }))
      .send({ business_id: id, reason: 'customer support ticket 42' })
      .expect(201);
    expect(grant.body.status).toBe('pending');

    // Owner sees it.
    const ownerList = await http
      .get(`/v1/businesses/${id}/support-grants`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .expect(200);
    expect(ownerList.body).toHaveLength(1);

    // Owner approves with a 48h request → capped at 24h.
    const farFuture = new Date(Date.now() + 48 * 3_600_000).toISOString();
    const approved = await http
      .post(`/v1/businesses/${id}/support-grants/${grant.body.id}/approve`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .send({ expires_at: farFuture })
      .expect(201);
    const granted = Date.parse(approved.body.granted_at);
    const expires = Date.parse(approved.body.expires_at);
    expect(expires - granted).toBeLessThanOrEqual(24 * 3_600_000 + 1000);

    // Operator reads detail under the grant → members + one audit row.
    const detail = await http
      .get(`/v1/admin/businesses/${id}/detail`)
      .set(ctx({ userId: operator, kind: 'operator' }))
      .expect(200);
    expect(detail.body.members.length).toBeGreaterThanOrEqual(1);

    const audit = await http
      .get(`/v1/businesses/${id}/audit-log`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .expect(200);
    expect(
      audit.body.some(
        (r: { action: string }) => r.action === 'business.detail.read',
      ),
    ).toBe(true);

    // Owner revokes → detail denied again.
    await http
      .post(`/v1/businesses/${id}/support-grants/${grant.body.id}/revoke`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .expect(201);
    await http
      .get(`/v1/admin/businesses/${id}/detail`)
      .set(ctx({ userId: operator, kind: 'operator' }))
      .expect(403);
  });

  it('an expired grant denies again', async () => {
    const { id, owner } = await provisionBusiness();
    const operator = randomUUID();
    const grant = await http
      .post('/v1/admin/support-grants')
      .set(ctx({ userId: operator, kind: 'operator' }))
      .send({ business_id: id, reason: 'expiry test' })
      .expect(201);
    await http
      .post(`/v1/businesses/${id}/support-grants/${grant.body.id}/approve`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .send({})
      .expect(201);
    // Force it into the past.
    await prisma.runInTenantContext(id, (tx) =>
      tx.supportAccessGrant.update({
        where: { id: grant.body.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      }),
    );
    await http
      .get(`/v1/admin/businesses/${id}/detail`)
      .set(ctx({ userId: operator, kind: 'operator' }))
      .expect(403);
  });
});
