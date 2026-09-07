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

async function seedBusiness(
  name = 'Duka Invites',
): Promise<{ id: string; owner: string }> {
  const owner = randomUUID();
  const res = await http
    .post('/v1/businesses')
    .set(ctx({ userId: owner }))
    .send({ name })
    .expect(201);
  return { id: res.body.id as string, owner };
}

beforeAll(async () => {
  bus = new InMemoryBus();
  await bus.reply(SUBJECTS.identity.getUser, async (raw) => {
    const q = raw as { user_id?: string };
    return q.user_id
      ? {
          found: true,
          user_id: q.user_id,
          name: 'Invitee',
          email: `${q.user_id.slice(0, 8)}@example.com`,
          phone: null,
          disabled: false,
          locale: 'en',
        }
      : { found: false };
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

async function tokenFor(businessId: string): Promise<string> {
  await app.get(OutboxRelayService).tick();
  const evt = [...bus.publishes]
    .reverse()
    .find(
      (p) =>
        p.subject === SUBJECTS.tenancy.invitationCreated &&
        (p.data as { payload: { business_id: string } }).payload.business_id ===
          businessId,
    );
  const url = (evt!.data as { payload: { accept_url: string } }).payload
    .accept_url;
  return new URL(url).searchParams.get('token') as string;
}

describe('tenancy — invitations', () => {
  it('Owner creates an invitation; response has no token; InvitationCreated carries one', async () => {
    const { id, owner } = await seedBusiness();
    bus.publishes.length = 0;

    const res = await http
      .post(`/v1/businesses/${id}/invitations`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .send({ email: 'staff@example.com' })
      .expect(201);

    expect(res.body).toMatchObject({
      email: 'staff@example.com',
      role: 'staff',
    });
    expect(res.body.token).toBeUndefined();

    const token = await tokenFor(id);
    expect(token).toBeTruthy();
  });

  it('a Staff caller cannot create an invitation', async () => {
    const { id } = await seedBusiness();
    const staff = randomUUID();
    await seedMembership(id, staff, 'staff');
    await http
      .post(`/v1/businesses/${id}/invitations`)
      .set(ctx({ userId: staff, businessId: id, role: 'staff' }))
      .send({ email: 'x@example.com' })
      .expect(403);
  });

  it('an invitee accepts the token → Staff membership; a second accept → 410', async () => {
    const { id, owner } = await seedBusiness();
    bus.publishes.length = 0;
    await http
      .post(`/v1/businesses/${id}/invitations`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .send({ email: 'newbie@example.com' })
      .expect(201);
    const token = await tokenFor(id);

    const invitee = randomUUID();
    const accept = await http
      .post('/v1/invitations/accept')
      .set(ctx({ userId: invitee }))
      .send({ token })
      .expect(201);
    expect(accept.body).toMatchObject({
      business_id: id,
      role: 'staff',
      status: 'active',
    });

    const membership = await prisma.runInTenantContext(id, (tx) =>
      tx.membership.findUnique({
        where: { businessId_userId: { businessId: id, userId: invitee } },
      }),
    );
    expect(membership?.role).toBe('staff');

    await http
      .post('/v1/invitations/accept')
      .set(ctx({ userId: randomUUID() }))
      .send({ token })
      .expect(410);
  });

  it('an expired invitation → accept returns 410 and the row is marked expired', async () => {
    const { id, owner } = await seedBusiness();
    bus.publishes.length = 0;
    await http
      .post(`/v1/businesses/${id}/invitations`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .send({ email: 'late@example.com' })
      .expect(201);
    const token = await tokenFor(id);

    await prisma.runInTenantContext(id, (tx) =>
      tx.invitation.updateMany({
        where: { businessId: id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      }),
    );

    await http
      .post('/v1/invitations/accept')
      .set(ctx({ userId: randomUUID() }))
      .send({ token })
      .expect(410);

    const row = await prisma.runInTenantContext(id, (tx) =>
      tx.invitation.findFirst({ where: { businessId: id } }),
    );
    expect(row?.status).toBe('expired');
  });

  it('a revoked invitation → accept returns 410', async () => {
    const { id, owner } = await seedBusiness();
    bus.publishes.length = 0;
    const created = await http
      .post(`/v1/businesses/${id}/invitations`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .send({ email: 'gone@example.com' })
      .expect(201);
    const token = await tokenFor(id);

    await http
      .post(`/v1/businesses/${id}/invitations/${created.body.id}/revoke`)
      .set(ctx({ userId: owner, businessId: id, role: 'owner' }))
      .expect(201);

    await http
      .post('/v1/invitations/accept')
      .set(ctx({ userId: randomUUID() }))
      .send({ token })
      .expect(410);
  });

  it('GET lists only this business invitations', async () => {
    const a = await seedBusiness('Biz A');
    const b = await seedBusiness('Biz B');
    for (const biz of [a, b]) {
      await http
        .post(`/v1/businesses/${biz.id}/invitations`)
        .set(ctx({ userId: biz.owner, businessId: biz.id, role: 'owner' }))
        .send({ email: `s-${biz.id.slice(0, 6)}@example.com` })
        .expect(201);
    }
    const listA = await http
      .get(`/v1/businesses/${a.id}/invitations`)
      .set(ctx({ userId: a.owner, businessId: a.id, role: 'owner' }))
      .expect(200);
    expect(listA.body).toHaveLength(1);
    expect(listA.body[0].email).toContain(a.id.slice(0, 6));
  });
});

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
