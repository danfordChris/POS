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
import { PrismaService } from '../src/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
const userA = uuidv7();
const suspendedUser = uuidv7();

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

const wrongBusiness = () =>
  hdr({ user_id: userA, business_id: bizB, role: 'owner', token_kind: 'user' });
const operator = () =>
  hdr({
    user_id: uuidv7(),
    business_id: null,
    role: null,
    token_kind: 'operator',
  });
const noRole = () =>
  hdr({ user_id: userA, business_id: bizA, role: null, token_kind: 'user' });
/** A signed user context with no business scope (the shape Kong sends on `/v1/winger/*`). */
const portalUser = (uid: string) =>
  hdr({ user_id: uid, business_id: null, role: null, token_kind: 'user' });

const wid = uuidv7();
const OWNER_ROUTES: [string, string][] = [
  ['post', `/v1/businesses/${bizA}/winger-accounts`],
  ['get', `/v1/businesses/${bizA}/winger-accounts`],
  ['patch', `/v1/businesses/${bizA}/winger-accounts/${wid}`],
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
  prisma = app.get(PrismaService);
  http = request(app.getHttpServer());

  await prisma.runInTenantContext(bizA, (tx) =>
    tx.wingerAccount.create({
      data: {
        businessId: bizA,
        userId: suspendedUser,
        authorizedBy: uuidv7(),
        status: 'suspended',
      },
    }),
  );
});

afterAll(async () => {
  await prisma.runInTenantContext(bizA, (tx) =>
    tx.wingerAccount.deleteMany({}),
  );
  await app.close();
});

describe('winger — cross-tenant isolation', () => {
  for (const [method, path] of OWNER_ROUTES) {
    const send = (headers: Record<string, string>) =>
      (http[method as 'get'](path) as request.Test).set(headers).send({});

    it(`${method.toUpperCase()} ${path.replace(bizA, ':biz')} → 403 for wrong-business / operator / roleless`, async () => {
      expect((await send(wrongBusiness())).status).toBe(403);
      const op = await send(operator());
      expect(op.status).toBe(403);
      expect(op.body.error?.code).toBe('operator_data_access_denied');
      expect((await send(noRole())).status).toBe(403);
    });
  }

  it('GET /v1/winger/businesses/:id/products → 403 for a non-winger', async () => {
    const res = await http
      .get(`/v1/winger/businesses/${bizA}/products`)
      .set(portalUser(uuidv7()))
      .send();
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('winger_scope_denied');
  });

  it('GET /v1/winger/businesses/:id/products → 403 for a SUSPENDED winger', async () => {
    const res = await http
      .get(`/v1/winger/businesses/${bizA}/products`)
      .set(portalUser(suspendedUser))
      .send();
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('winger_scope_denied');
  });

  it('GET /v1/winger/businesses → 403 for an operator context', async () => {
    const res = await http.get('/v1/winger/businesses').set(operator()).send();
    expect(res.status).toBe(403);
  });

  it('GET /v1/winger/businesses → empty list for a non-winger (no leak)', async () => {
    const res = await http
      .get('/v1/winger/businesses')
      .set(portalUser(uuidv7()))
      .send();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
