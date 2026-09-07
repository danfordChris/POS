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
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';

let app: INestApplication;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
const userA = uuidv7();

function hdr(ctx: {
  user_id: string | null;
  business_id: string | null;
  role: 'owner' | 'staff' | null;
  token_kind: 'user' | 'operator';
}) {
  const { header, signature } = signInternalContext(
    { request_id: `iso-${uuidv7()}`, ...ctx },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

// Signed for business B, used against a business-A path → the guard must 403.
const wrongBusiness = () =>
  hdr({ user_id: userA, business_id: bizB, role: 'owner', token_kind: 'user' });
// An operator-audience context on any tenant data route → 403.
const operator = () =>
  hdr({
    user_id: uuidv7(),
    business_id: null,
    role: null,
    token_kind: 'operator',
  });
// A user context with no role → not an active member → 403.
const noRole = () =>
  hdr({ user_id: userA, business_id: bizA, role: null, token_kind: 'user' });
// The correct member of business A → the guard passes (handler may 200/404/422).
const memberA = () =>
  hdr({ user_id: userA, business_id: bizA, role: 'owner', token_kind: 'user' });

const s = uuidv7();
const c = uuidv7();
const inv = uuidv7();
const ROUTES: [string, string][] = [
  ['post', `/v1/businesses/${bizA}/sales`],
  ['get', `/v1/businesses/${bizA}/sales`],
  ['get', `/v1/businesses/${bizA}/sales/${s}`],
  ['post', `/v1/businesses/${bizA}/sales/${s}/void`],
  // Phase 07 — customers + invoices.
  ['post', `/v1/businesses/${bizA}/customers`],
  ['get', `/v1/businesses/${bizA}/customers`],
  ['get', `/v1/businesses/${bizA}/customers/${c}`],
  ['patch', `/v1/businesses/${bizA}/customers/${c}`],
  ['post', `/v1/businesses/${bizA}/invoices`],
  ['get', `/v1/businesses/${bizA}/invoices`],
  ['get', `/v1/businesses/${bizA}/invoices/${inv}`],
  ['post', `/v1/businesses/${bizA}/invoices/${inv}/payments`],
  ['post', `/v1/businesses/${bizA}/invoices/${inv}/void`],
];

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
});

afterAll(async () => {
  await app.close();
});

describe('sales — cross-tenant isolation', () => {
  for (const [method, path] of ROUTES) {
    const send = (headers: Record<string, string>) =>
      (http[method as 'get'](path) as request.Test).set(headers).send({});

    it(`${method.toUpperCase()} ${path.replace(bizA, ':biz')} → 403 for a wrong-business context`, async () => {
      const res = await send(wrongBusiness());
      expect(res.status).toBe(403);
    });

    it(`${method.toUpperCase()} ${path.replace(bizA, ':biz')} → 403 for an operator context`, async () => {
      const res = await send(operator());
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('operator_data_access_denied');
    });

    it(`${method.toUpperCase()} ${path.replace(bizA, ':biz')} → 403 for a roleless context`, async () => {
      const res = await send(noRole());
      expect(res.status).toBe(403);
    });
  }

  it('the correct member of the business is NOT blocked by the guard', async () => {
    const res = await http
      .get(`/v1/businesses/${bizA}/sales`)
      .set(memberA())
      .send();
    expect(res.status).not.toBe(403);
  });
});
