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
import { OutboxRelayService } from '../src/platform/outbox-relay.service.js';

let app: INestApplication;
let prisma: PrismaService;
let bus: InMemoryBus;
let relay: OutboxRelayService;
let http: ReturnType<typeof request>;

const SECRET = process.env.INTERNAL_CONTEXT_SECRET as string;
const API_KEY = process.env.INTERNAL_API_KEY ?? 'dev-internal-api-key';

/** Build the signed internal-context headers a real Kong plugin would send. */
function ctx(opts: {
  userId?: string | null;
  businessId?: string | null;
  role?: 'owner' | 'staff' | null;
  kind?: 'user' | 'operator' | 'system';
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

async function seedMembership(
  businessId: string,
  userId: string,
  role: 'owner' | 'staff',
) {
  await prisma.runInTenantContext(businessId, (tx) =>
    tx.membership.create({
      data: { businessId, userId, role, status: 'active' },
    }),
  );
}

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
  await app.close();
});

describe('tenancy — POST /v1/businesses', () => {
  it('creates the business + owner membership and emits BusinessCreated + MembershipCreated', async () => {
    const owner = randomUUID();
    const res = await http
      .post('/v1/businesses')
      .set(ctx({ userId: owner }))
      .send({ name: 'Duka Kuu' })
      .expect(201);
    expect(res.body).toMatchObject({ name: 'Duka Kuu', currency: 'TZS' });

    const membership = await prisma.runInTenantContext(res.body.id, (tx) =>
      tx.membership.findUnique({
        where: {
          businessId_userId: { businessId: res.body.id, userId: owner },
        },
      }),
    );
    expect(membership).toMatchObject({ role: 'owner', status: 'active' });

    await relay.tick();
    const subjects = bus.publishes.map((p) => p.subject);
    expect(subjects).toContain(SUBJECTS.tenancy.businessCreated);
    expect(subjects).toContain(SUBJECTS.tenancy.membershipCreated);
  });

  it('rejects a request with no internal context (500 internal_context_invalid)', async () => {
    const res = await http
      .post('/v1/businesses')
      .send({ name: 'x' })
      .expect(500);
    expect(res.body.error.code).toBe('internal_context_invalid');
    expect(res.body.error.message).toBeTruthy();
    expect(res.body.error.devMessage).toBeTruthy();
  });

  it('rejects a tampered internal context', async () => {
    const headers = ctx({ userId: randomUUID() });
    headers[INTERNAL_CONTEXT_SIGNATURE_HEADER] = 'deadbeef';
    await http
      .post('/v1/businesses')
      .set(headers)
      .send({ name: 'x' })
      .expect(500);
  });
});

describe('tenancy — GET/PATCH /v1/businesses/:id', () => {
  let bizId = '';
  const owner = randomUUID();
  const staff = randomUUID();
  const stranger = randomUUID();

  beforeAll(async () => {
    const res = await http
      .post('/v1/businesses')
      .set(ctx({ userId: owner }))
      .send({ name: 'RBAC Shop' });
    bizId = res.body.id;
    await seedMembership(bizId, staff, 'staff');
  });

  it('owner reads and updates; staff cannot update (role_forbidden); stranger 403 not_a_member', async () => {
    const read = await http
      .get(`/v1/businesses/${bizId}`)
      .set(ctx({ userId: owner, businessId: bizId }))
      .expect(200);
    expect(read.body.role).toBe('owner');

    const denied = await http
      .patch(`/v1/businesses/${bizId}`)
      .set(ctx({ userId: staff, businessId: bizId }))
      .send({ name: 'nope' })
      .expect(403);
    expect(denied.body.error.code).toBe('role_forbidden');

    const ok = await http
      .patch(`/v1/businesses/${bizId}`)
      .set(ctx({ userId: owner, businessId: bizId }))
      .send({ name: 'Renamed' })
      .expect(200);
    expect(ok.body.name).toBe('Renamed');

    const outsider = await http
      .get(`/v1/businesses/${bizId}`)
      .set(ctx({ userId: stranger, businessId: bizId }))
      .expect(403);
    expect(outsider.body.error.code).toBe('not_a_member');
  });

  it('an operator-kind context is refused with operator_data_access_denied', async () => {
    const res = await http
      .get(`/v1/businesses/${bizId}`)
      .set(ctx({ userId: randomUUID(), businessId: bizId, kind: 'operator' }))
      .expect(403);
    expect(res.body.error.code).toBe('operator_data_access_denied');
  });

  it('suspending a member emits MembershipSuspended and blocks that member', async () => {
    await http
      .patch(`/v1/businesses/${bizId}/members/${staff}`)
      .set(ctx({ userId: owner, businessId: bizId }))
      .send({ status: 'suspended' })
      .expect(200);

    await relay.tick();
    expect(bus.publishes.map((p) => p.subject)).toContain(
      SUBJECTS.tenancy.membershipSuspended,
    );

    await http
      .get(`/v1/businesses/${bizId}`)
      .set(ctx({ userId: staff, businessId: bizId }))
      .expect(403);
  });
});

describe('tenancy — RLS backstop', () => {
  it('unscoped writes are rejected and the tenant-context assertion fires', async () => {
    // `business` / `membership` carry a SELECT-only `control_plane_read`
    // PERMISSIVE policy (migration 20260908150000) so the operator
    // `/v1/admin/businesses` list can read id/name/status/counts with no
    // business context. The security-critical invariants are unchanged: an
    // unscoped WRITE is still rejected, and the app layer still refuses tenant
    // model access without a context.
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO business (name) VALUES ('sneaky')`),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO membership (business_id, user_id, role) VALUES ('018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f','018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d60','staff')`,
      ),
    ).rejects.toThrow();
    expect(() => prisma.assertTenantContext()).toThrow();
  });
});

describe('tenancy — internal membership + RPC', () => {
  let bizId = '';
  const owner = randomUUID();

  beforeAll(async () => {
    const res = await http
      .post('/v1/businesses')
      .set(ctx({ userId: owner }))
      .send({ name: 'RPC Shop' });
    bizId = res.body.id;
  });

  it('GET /internal/membership needs the api key and returns the membership', async () => {
    await http
      .get('/v1/internal/membership')
      .query({ business_id: bizId, user_id: owner })
      .expect(401);

    const res = await http
      .get('/v1/internal/membership')
      .query({ business_id: bizId, user_id: owner })
      .set('X-Internal-Api-Key', API_KEY)
      .expect(200);
    expect(res.body).toMatchObject({
      found: true,
      role: 'owner',
      status: 'active',
    });
  });

  it('pos.rpc.tenancy.resolveMembership resolves and reports not-found', async () => {
    const hit = await bus.request(SUBJECTS.tenancy.resolveMembership, {
      business_id: bizId,
      user_id: owner,
    });
    expect(hit).toMatchObject({ found: true, role: 'owner', status: 'active' });

    const miss = await bus.request(SUBJECTS.tenancy.resolveMembership, {
      business_id: bizId,
      user_id: randomUUID(),
    });
    expect(miss).toMatchObject({ found: false, role: null });
  });
});
