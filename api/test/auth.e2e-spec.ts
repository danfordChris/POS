import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { configureApp, registerNotFoundFallback } from '../src/app.factory.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

const operatorEmail = `op-${randomUUID()}@example.com`;
const operatorPassword = 'operator-pass-123';
let operatorId: string;

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
      name: 'Ops One',
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

function newEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

describe('Auth (e2e)', () => {
  it('registers a user (201) and rejects a duplicate email (409)', async () => {
    const email = newEmail('dup');
    const body = { name: 'Asha', email, password: 'password12345' };

    const created = await http.post('/v1/auth/register').send(body).expect(201);
    expect(created.body).toMatchObject({ email, name: 'Asha', locale: 'en' });
    expect(created.body.id).toBeDefined();
    expect(created.body.passwordHash).toBeUndefined();

    const conflict = await http
      .post('/v1/auth/register')
      .send(body)
      .expect(409);
    expect(conflict.body.error.code).toBe('conflict');
  });

  it('rejects registration with neither email nor phone (400 validation_error)', async () => {
    const res = await http
      .post('/v1/auth/register')
      .send({ name: 'NoContact', password: 'password12345' })
      .expect(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('logs in with valid credentials and rejects a wrong password', async () => {
    const email = newEmail('login');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Lg', email, password: 'password12345' });

    const bad = await http
      .post('/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    expect(bad.body.error.code).toBe('unauthenticated');

    const ok = await http
      .post('/v1/auth/login')
      .send({ email, password: 'password12345' })
      .expect(200);
    expect(ok.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(ok.body.accessToken).toBeDefined();
    expect(ok.body.refreshToken).toBeDefined();
  });

  it('returns the identity for GET /v1/auth/me and 401 without a token', async () => {
    const email = newEmail('me');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Me', email, password: 'password12345' });
    const { body: session } = await http
      .post('/v1/auth/login')
      .send({ email, password: 'password12345' })
      .expect(200);

    await http.get('/v1/auth/me').expect(401);

    const me = await http
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({
      email,
      memberships: [],
      wingerAccounts: [],
    });
  });

  it('rotates the refresh token and revokes the family on reuse', async () => {
    const email = newEmail('rotate');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Rot', email, password: 'password12345' });
    const { body: first } = await http
      .post('/v1/auth/login')
      .send({ email, password: 'password12345' })
      .expect(200);

    const { body: second } = await http
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // Reusing the now-rotated first token is rejected...
    const reuse = await http
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    expect(reuse.body.error.code).toBe('unauthenticated');

    // ...and it also kills the rest of the family (the second token).
    await http
      .post('/v1/auth/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(401);
  });

  it('logs out, invalidating the refresh token', async () => {
    const email = newEmail('logout');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Lo', email, password: 'password12345' });
    const { body: session } = await http
      .post('/v1/auth/login')
      .send({ email, password: 'password12345' })
      .expect(200);

    await http
      .post('/v1/auth/logout')
      .send({ refreshToken: session.refreshToken })
      .expect(204);
    await http
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('keeps user and operator token audiences separate', async () => {
    const email = newEmail('aud');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Aud', email, password: 'password12345' });
    const { body: userSession } = await http
      .post('/v1/auth/login')
      .send({ email, password: 'password12345' })
      .expect(200);
    const { body: opSession } = await http
      .post('/v1/auth/operator/login')
      .send({ email: operatorEmail, password: operatorPassword })
      .expect(200);

    // operator token on a user route
    const a = await http
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${opSession.accessToken}`)
      .expect(401);
    expect(a.body.error.code).toBe('wrong_token_audience');

    // user token on an operator route
    const b = await http
      .get('/v1/auth/operator/me')
      .set('Authorization', `Bearer ${userSession.accessToken}`)
      .expect(401);
    expect(b.body.error.code).toBe('wrong_token_audience');

    // operator token on the operator route
    const ok = await http
      .get('/v1/auth/operator/me')
      .set('Authorization', `Bearer ${opSession.accessToken}`)
      .expect(200);
    expect(ok.body).toMatchObject({ email: operatorEmail });
  });

  it('rate-limits repeated failed logins for one identity (429)', async () => {
    const email = newEmail('rl');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Rl', email, password: 'password12345' });

    for (let i = 0; i < 5; i += 1) {
      await http
        .post('/v1/auth/login')
        .send({ email, password: 'nope' })
        .expect(401);
    }

    const throttled = await http
      .post('/v1/auth/login')
      .send({ email, password: 'nope' })
      .expect(429);
    expect(throttled.body.error.code).toBe('rate_limited');
  });
});
