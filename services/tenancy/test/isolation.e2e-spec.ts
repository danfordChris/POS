import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import {
  configureApp,
  registerNotFoundFallback,
  signInternalContext,
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_CONTEXT_SIGNATURE_HEADER,
  MESSAGE_BUS,
} from '@pos/nest-common';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';

let app: INestApplication;
let http: ReturnType<typeof request>;

const SECRET = process.env.INTERNAL_CONTEXT_SECRET as string;

function hdr(ctx: {
  user_id: string | null;
  business_id: string | null;
  role: 'owner' | 'staff' | null;
  token_kind: 'user' | 'operator';
}) {
  const { header, signature } = signInternalContext(
    { request_id: `iso-${randomUUID()}`, ...ctx },
    SECRET,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

let bizA = '';
let bizB = '';
let ownerA = '';
const gid = randomUUID();
const invId = randomUUID();

const wrongBusiness = () =>
  hdr({
    user_id: ownerA,
    business_id: bizB,
    role: 'owner',
    token_kind: 'user',
  });
const operator = () =>
  hdr({
    user_id: randomUUID(),
    business_id: null,
    role: null,
    token_kind: 'operator',
  });
const stranger = () =>
  hdr({
    user_id: randomUUID(),
    business_id: bizA,
    role: 'owner',
    token_kind: 'user',
  });
const memberA = () =>
  hdr({
    user_id: ownerA,
    business_id: bizA,
    role: 'owner',
    token_kind: 'user',
  });

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);
  http = request(app.getHttpServer());

  ownerA = randomUUID();
  const a = await http
    .post('/v1/businesses')
    .set(
      hdr({
        user_id: ownerA,
        business_id: null,
        role: null,
        token_kind: 'user',
      }),
    )
    .send({ name: 'Iso A' });
  bizA = a.body.id;
  const b = await http
    .post('/v1/businesses')
    .set(
      hdr({
        user_id: randomUUID(),
        business_id: null,
        role: null,
        token_kind: 'user',
      }),
    )
    .send({ name: 'Iso B' });
  bizB = b.body.id;
});

afterAll(async () => {
  await app.close();
});

describe('tenancy — cross-tenant isolation', () => {
  const routes = (): [string, string][] => [
    ['get', `/v1/businesses/${bizA}`],
    ['patch', `/v1/businesses/${bizA}`],
    ['get', `/v1/businesses/${bizA}/members`],
    ['get', `/v1/businesses/${bizA}/invitations`],
    ['post', `/v1/businesses/${bizA}/invitations`],
    ['post', `/v1/businesses/${bizA}/invitations/${invId}/revoke`],
    ['get', `/v1/businesses/${bizA}/support-grants`],
    ['post', `/v1/businesses/${bizA}/support-grants/${gid}/approve`],
    ['post', `/v1/businesses/${bizA}/support-grants/${gid}/revoke`],
    ['get', `/v1/businesses/${bizA}/audit-log`],
  ];

  it('every business-scoped route → 403 for a wrong-business / operator / non-member context', async () => {
    for (const [method, path] of routes()) {
      const send = (h: Record<string, string>) =>
        (http[method as 'get'](path) as request.Test).set(h).send({});
      const label = `${method.toUpperCase()} ${path.replace(bizA, ':biz')}`;
      expect([403], `${label} wrong-business`).toContain(
        (await send(wrongBusiness())).status,
      );
      const op = await send(operator());
      expect([403], `${label} operator`).toContain(op.status);
      expect(op.body.error?.code).toBe('operator_data_access_denied');
      expect([403], `${label} non-member`).toContain(
        (await send(stranger())).status,
      );
    }
  });

  it('the Owner of the business is NOT blocked by the guard', async () => {
    const res = await http
      .get(`/v1/businesses/${bizA}/members`)
      .set(memberA())
      .send();
    expect(res.status).not.toBe(403);
  });
});
