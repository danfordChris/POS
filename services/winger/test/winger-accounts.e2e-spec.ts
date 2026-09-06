import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
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
import { SUBJECTS } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { IdentityClient } from '../src/rpc/identity-client.js';
import { TenancyClient } from '../src/rpc/tenancy-client.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
const ownerId = uuidv7();

const resellerUserId = uuidv7();
const identity = {
  getUser: vi.fn(),
};
const tenancy = {
  resolveMembership: vi.fn(async () => ({
    found: false,
    role: null,
    status: null,
  })),
};

function ctx(
  businessId: string,
  role: 'owner' | 'staff' = 'owner',
  userId: string = ownerId,
) {
  const { header, signature } = signInternalContext(
    {
      request_id: `t-${uuidv7()}`,
      user_id: userId,
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

const url = (biz: string) => `/v1/businesses/${biz}/winger-accounts`;

const authorizedEvents = (biz: string) =>
  prisma.outboxMessage
    .findMany({ where: { subject: SUBJECTS.winger.wingerAuthorized } })
    .then((rs) =>
      rs
        .map((r) => (r.payload as { payload: { business_id: string } }).payload)
        .filter((p) => p.business_id === biz),
    );

const suspendedEvents = (biz: string) =>
  prisma.outboxMessage
    .findMany({ where: { subject: SUBJECTS.winger.wingerSuspended } })
    .then((rs) =>
      rs
        .map((r) => (r.payload as { payload: { business_id: string } }).payload)
        .filter((p) => p.business_id === biz),
    );

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .overrideProvider(IdentityClient)
    .useValue(identity)
    .overrideProvider(TenancyClient)
    .useValue(tenancy)
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);

  prisma = app.get(PrismaService);
  http = request(app.getHttpServer());
});

afterAll(async () => {
  await prisma.runInTenantContext(bizA, async (tx) => {
    await tx.wingerAccount.deleteMany({});
  });
  await prisma.runInTenantContext(bizB, async (tx) => {
    await tx.wingerAccount.deleteMany({});
  });
  await prisma.outboxMessage.deleteMany({});
  await app.close();
});

beforeEach(() => {
  identity.getUser.mockReset();
  tenancy.resolveMembership.mockReset();
  tenancy.resolveMembership.mockResolvedValue({
    found: false,
    role: null,
    status: null,
  });
});

describe('winger-accounts — Owner endpoints', () => {
  it('authorizes a reseller by email and emits one WingerAuthorized', async () => {
    identity.getUser.mockResolvedValue({
      found: true,
      user_id: resellerUserId,
      name: 'reseller',
      email: 'reseller@example.com',
      phone: null,
      disabled: false,
      locale: 'sw',
    });

    const { body } = await http
      .post(url(bizA))
      .set(ctx(bizA))
      .send({ email: 'reseller@example.com' })
      .expect(201);

    expect(body).toMatchObject({
      user_id: resellerUserId,
      status: 'active',
      email: 'reseller@example.com',
    });
    expect(identity.getUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'reseller@example.com', create: true }),
    );

    const events = await authorizedEvents(bizA);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      user_id: resellerUserId,
      email: 'reseller@example.com',
      locale: 'sw',
      portal_url: expect.stringMatching(/\/winger$/),
    });
  });

  it('is idempotent — re-authorizing an active account emits nothing new', async () => {
    identity.getUser.mockResolvedValue({
      found: true,
      user_id: resellerUserId,
      name: 'reseller',
      email: 'reseller@example.com',
      phone: null,
      disabled: false,
      locale: 'sw',
    });

    await http
      .post(url(bizA))
      .set(ctx(bizA))
      .send({ email: 'reseller@example.com' })
      .expect(201);

    expect(await authorizedEvents(bizA)).toHaveLength(1);
  });

  it('rejects a user who already has a membership with 409', async () => {
    identity.getUser.mockResolvedValue({
      found: true,
      user_id: uuidv7(),
      name: 'staffer',
      email: 'staffer@example.com',
      phone: null,
      disabled: false,
      locale: 'en',
    });
    tenancy.resolveMembership.mockResolvedValue({
      found: true,
      role: 'staff',
      status: 'active',
    });

    const { body } = await http
      .post(url(bizB))
      .set(ctx(bizB))
      .send({ email: 'staffer@example.com' })
      .expect(409);
    expect(body.error.code).toBe('already_a_member');
    expect(await authorizedEvents(bizB)).toHaveLength(0);
  });

  it('rejects a body with both email and phone', async () => {
    await http
      .post(url(bizB))
      .set(ctx(bizB))
      .send({ email: 'x@example.com', phone: '+255700000000' })
      .expect(400);
  });

  it('forbids a staff caller', async () => {
    await http
      .post(url(bizA))
      .set(ctx(bizA, 'staff'))
      .send({ email: 'nope@example.com' })
      .expect(403);
  });

  it('lists the business accounts only', async () => {
    identity.getUser.mockResolvedValue({
      found: true,
      user_id: resellerUserId,
      name: 'reseller',
      email: 'reseller@example.com',
      phone: null,
      disabled: false,
      locale: 'sw',
    });

    const { body } = await http.get(url(bizA)).set(ctx(bizA)).expect(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].user_id).toBe(resellerUserId);

    const { body: other } = await http
      .get(url(bizB))
      .set(ctx(bizB))
      .expect(200);
    expect(other).toHaveLength(0);
  });

  it('suspends then reactivates, emitting the matching events', async () => {
    identity.getUser.mockResolvedValue({
      found: true,
      user_id: resellerUserId,
      name: 'reseller',
      email: 'reseller@example.com',
      phone: null,
      disabled: false,
      locale: 'sw',
    });

    const { body: list } = await http.get(url(bizA)).set(ctx(bizA)).expect(200);
    const id = list[0].id as string;

    await http
      .patch(`${url(bizA)}/${id}`)
      .set(ctx(bizA))
      .send({ status: 'suspended' })
      .expect(200);
    expect(await suspendedEvents(bizA)).toHaveLength(1);

    // no-op repeat
    await http
      .patch(`${url(bizA)}/${id}`)
      .set(ctx(bizA))
      .send({ status: 'suspended' })
      .expect(200);
    expect(await suspendedEvents(bizA)).toHaveLength(1);

    const before = (await authorizedEvents(bizA)).length;
    await http
      .patch(`${url(bizA)}/${id}`)
      .set(ctx(bizA))
      .send({ status: 'active' })
      .expect(200);
    expect((await authorizedEvents(bizA)).length).toBe(before + 1);
  });

  it('returns 404 for an unknown account id', async () => {
    await http
      .patch(`${url(bizA)}/${uuidv7()}`)
      .set(ctx(bizA))
      .send({ status: 'suspended' })
      .expect(404);
  });

  it('propagates an identity RPC outage as 503 and writes nothing', async () => {
    identity.getUser.mockRejectedValue(
      new ServiceUnavailableException({
        code: 'upstream_unavailable',
        message: 'Identity service is unavailable. Try again shortly.',
      }),
    );

    const { body } = await http
      .post(url(bizB))
      .set(ctx(bizB))
      .send({ email: 'outage@example.com' })
      .expect(503);
    expect(body.error.code).toBe('upstream_unavailable');
    expect(await authorizedEvents(bizB)).toHaveLength(0);
    const rows = await prisma.runInTenantContext(bizB, (tx) =>
      tx.wingerAccount.count(),
    );
    expect(rows).toBe(0);
  });
});
