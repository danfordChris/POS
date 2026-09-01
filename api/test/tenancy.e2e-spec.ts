import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { configureApp, registerNotFoundFallback } from '../src/app.factory.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { hashPassword } from '../src/auth/password.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

const operatorEmail = `op-${randomUUID()}@example.com`;
const operatorPassword = 'operator-pass-123';
let operatorId = '';

async function registerAndLogin(
  label: string,
): Promise<{ userId: string; accessToken: string }> {
  const email = `${label}-${randomUUID()}@example.com`;
  const reg = await http
    .post('/v1/auth/register')
    .send({ name: label, email, password: 'password12345' })
    .expect(201);
  const login = await http
    .post('/v1/auth/login')
    .send({ email, password: 'password12345' })
    .expect(200);
  return { userId: reg.body.id, accessToken: login.body.accessToken };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);
  prisma = app.get(PrismaService);
  http = request(app.getHttpServer());

  const operator = await prisma.operator.create({
    data: {
      name: 'Ops',
      email: operatorEmail,
      passwordHash: await hashPassword(operatorPassword),
    },
  });
  operatorId = operator.id;
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { subjectId: operatorId } });
  await prisma.operator.deleteMany({ where: { id: operatorId } });
  await app.close();
});

describe('Tenancy (e2e)', () => {
  it('POST /v1/businesses creates the business and an owner membership for the caller', async () => {
    const owner = await registerAndLogin('owner');

    const res = await http
      .post('/v1/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Duka Kuu' })
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Duka Kuu',
      currency: 'TZS',
      locale: 'en',
    });

    const membership = await prisma.runInTenantContext(res.body.id, (tx) =>
      tx.membership.findUnique({
        where: {
          businessId_userId: { businessId: res.body.id, userId: owner.userId },
        },
      }),
    );
    expect(membership).toMatchObject({ role: 'owner', status: 'active' });

    // owner can read it back
    await http
      .get(`/v1/businesses/${res.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
  });

  it('a member of business A gets 403 not_a_member on business B routes', async () => {
    const a = await registerAndLogin('a');
    const b = await registerAndLogin('b');
    const bizA = (
      await http
        .post('/v1/businesses')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'A Shop' })
        .expect(201)
    ).body;
    await http
      .post('/v1/businesses')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ name: 'B Shop' })
      .expect(201);

    const res = await http
      .get(`/v1/businesses/${bizA.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe('not_a_member');
  });

  it('an operator token is refused on tenant routes with 403 operator_data_access_denied', async () => {
    const owner = await registerAndLogin('op-owner');
    const biz = (
      await http
        .post('/v1/businesses')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Op Shop' })
        .expect(201)
    ).body;
    const opLogin = await http
      .post('/v1/auth/operator/login')
      .send({ email: operatorEmail, password: operatorPassword })
      .expect(200);

    const res = await http
      .get(`/v1/businesses/${biz.id}`)
      .set('Authorization', `Bearer ${opLogin.body.accessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe('operator_data_access_denied');
  });

  it('staff get 403 role_forbidden on the owner-only PATCH; owner succeeds', async () => {
    const owner = await registerAndLogin('ro-owner');
    const staff = await registerAndLogin('ro-staff');
    const biz = (
      await http
        .post('/v1/businesses')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Role Shop' })
        .expect(201)
    ).body;

    await prisma.runInTenantContext(biz.id, (tx) =>
      tx.membership.create({
        data: {
          businessId: biz.id,
          userId: staff.userId,
          role: 'staff',
          status: 'active',
        },
      }),
    );

    const denied = await http
      .patch(`/v1/businesses/${biz.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ name: 'Renamed by staff' })
      .expect(403);
    expect(denied.body.error.code).toBe('role_forbidden');

    const ok = await http
      .patch(`/v1/businesses/${biz.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Renamed by owner' })
      .expect(200);
    expect(ok.body.name).toBe('Renamed by owner');
  });

  it('RLS blocks tenant rows when app.business_id is unset (context forgotten)', async () => {
    const owner = await registerAndLogin('rls-owner');
    await http
      .post('/v1/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'RLS Shop' })
      .expect(201);

    // Raw queries with no runInTenantContext wrapper: RLS returns nothing...
    const businesses = await prisma.$queryRawUnsafe<{ n: number }[]>(
      'SELECT COUNT(*)::int AS n FROM "business"',
    );
    const memberships = await prisma.$queryRawUnsafe<{ n: number }[]>(
      'SELECT COUNT(*)::int AS n FROM "membership"',
    );
    expect(businesses[0].n).toBe(0);
    expect(memberships[0].n).toBe(0);

    // ...and a write with no bound tenant is rejected outright.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "business" (name) VALUES ('sneaky')`,
      ),
    ).rejects.toThrow();

    expect(() => prisma.assertTenantContext()).toThrow();
  });
});
