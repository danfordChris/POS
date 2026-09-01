import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import {
  configureApp,
  registerNotFoundFallback,
  MESSAGE_BUS,
} from '@pos/nest-common';
import { SUBJECTS } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { OutboxRelayService } from '../src/platform/outbox-relay.service.js';
import { hashPassword } from '../src/auth/password.js';

let app: INestApplication;
let prisma: PrismaService;
let bus: InMemoryBus;
let relay: OutboxRelayService;
let http: ReturnType<typeof request>;

const operatorEmail = `op-${randomUUID()}@example.com`;
const operatorPassword = 'operator-pass-123';
let operatorId = '';

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

const email = (p: string) => `${p}-${randomUUID()}@example.com`;

describe('identity — auth HTTP (parity with Phase 00)', () => {
  it('register 201 + duplicate 409 + missing-contact 400', async () => {
    const body = {
      name: 'Asha',
      email: email('dup'),
      password: 'password12345',
    };
    const created = await http.post('/v1/auth/register').send(body).expect(201);
    expect(created.body).toMatchObject({
      email: body.email,
      name: 'Asha',
      locale: 'en',
    });
    expect(created.body.passwordHash).toBeUndefined();

    await http.post('/v1/auth/register').send(body).expect(409);

    const bad = await http
      .post('/v1/auth/register')
      .send({ name: 'x', password: 'password12345' })
      .expect(400);
    expect(bad.body.error.code).toBe('validation_error');
  });

  it('login + me + refresh rotation/reuse + logout', async () => {
    const e = email('flow');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Fl', email: e, password: 'password12345' });

    await http
      .post('/v1/auth/login')
      .send({ email: e, password: 'nope' })
      .expect(401);
    const { body: s } = await http
      .post('/v1/auth/login')
      .send({ email: e, password: 'password12345' })
      .expect(200);
    expect(s).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });

    await http.get('/v1/auth/me').expect(401);
    const me = await http
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${s.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({
      email: e,
      memberships: [],
      wingerAccounts: [],
    });

    const { body: r2 } = await http
      .post('/v1/auth/refresh')
      .send({ refreshToken: s.refreshToken })
      .expect(200);
    await http
      .post('/v1/auth/refresh')
      .send({ refreshToken: s.refreshToken })
      .expect(401);
    await http
      .post('/v1/auth/refresh')
      .send({ refreshToken: r2.refreshToken })
      .expect(401);

    const e2 = email('lo');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Lo', email: e2, password: 'password12345' });
    const { body: s2 } = await http
      .post('/v1/auth/login')
      .send({ email: e2, password: 'password12345' })
      .expect(200);
    await http
      .post('/v1/auth/logout')
      .send({ refreshToken: s2.refreshToken })
      .expect(204);
    await http
      .post('/v1/auth/refresh')
      .send({ refreshToken: s2.refreshToken })
      .expect(401);
  });

  it('token audiences stay separate', async () => {
    const e = email('aud');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Au', email: e, password: 'password12345' });
    const { body: u } = await http
      .post('/v1/auth/login')
      .send({ email: e, password: 'password12345' })
      .expect(200);
    const { body: o } = await http
      .post('/v1/auth/operator/login')
      .send({ email: operatorEmail, password: operatorPassword })
      .expect(200);

    const a = await http
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${o.accessToken}`)
      .expect(401);
    expect(a.body.error.code).toBe('wrong_token_audience');
    const b = await http
      .get('/v1/auth/operator/me')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .expect(401);
    expect(b.body.error.code).toBe('wrong_token_audience');
    await http
      .get('/v1/auth/operator/me')
      .set('Authorization', `Bearer ${o.accessToken}`)
      .expect(200);
  });

  it('rate-limits repeated failed logins (429)', async () => {
    const e = email('rl');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Rl', email: e, password: 'password12345' });
    for (let i = 0; i < 5; i += 1) {
      await http
        .post('/v1/auth/login')
        .send({ email: e, password: 'nope' })
        .expect(401);
    }
    const t = await http
      .post('/v1/auth/login')
      .send({ email: e, password: 'nope' })
      .expect(429);
    expect(t.body.error.code).toBe('rate_limited');
  });
});

describe('identity — UserRegistered outbox', () => {
  it('writes an outbox row in the register transaction; the relay publishes it', async () => {
    const e = email('outbox');
    const { body: user } = await http
      .post('/v1/auth/register')
      .send({ name: 'Ob', email: e, password: 'password12345' })
      .expect(201);

    const rows = await prisma.$queryRawUnsafe<
      { subject: string; payload: any }[]
    >(
      `SELECT subject, payload FROM outbox WHERE payload->'payload'->>'user_id' = $1`,
      user.id,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe(SUBJECTS.identity.userRegistered);

    const published = await relay.tick();
    expect(published).toBeGreaterThanOrEqual(1);
    const evt = bus.publishes.find(
      (p) =>
        p.subject === SUBJECTS.identity.userRegistered &&
        (p.data as any).payload.user_id === user.id,
    );
    expect(evt).toBeDefined();
  });
});

describe('identity — NATS RPC', () => {
  it('getUser resolves by email and reports not_found', async () => {
    const e = email('rpc');
    const { body: user } = await http
      .post('/v1/auth/register')
      .send({ name: 'Rp', email: e, password: 'password12345' })
      .expect(201);

    const hit = await bus.request(SUBJECTS.identity.getUser, { email: e });
    expect(hit).toMatchObject({
      found: true,
      user_id: user.id,
      email: e,
      disabled: false,
    });

    const miss = await bus.request(SUBJECTS.identity.getUser, {
      email: email('ghost'),
    });
    expect(miss).toEqual({ found: false });
  });

  it('verifyToken validates a real access token and rejects junk', async () => {
    const e = email('vt');
    await http
      .post('/v1/auth/register')
      .send({ name: 'Vt', email: e, password: 'password12345' });
    const { body: s } = await http
      .post('/v1/auth/login')
      .send({ email: e, password: 'password12345' })
      .expect(200);

    const ok = await bus.request(SUBJECTS.identity.verifyToken, {
      access_token: s.accessToken,
    });
    expect(ok).toMatchObject({ valid: true, aud: 'user', typ: 'access' });

    const bad = await bus.request(SUBJECTS.identity.verifyToken, {
      access_token: 'not-a-token',
    });
    expect(bad).toEqual({ valid: false });
  });
});
