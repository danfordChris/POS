import { INestApplication } from '@nestjs/common';
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
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { ObjectStore } from '../src/invoices/object-store.js';

let app: INestApplication;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();
const userA = uuidv7();
const invId = uuidv7();

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
  hdr({ user_id: uuidv7(), business_id: null, role: null, token_kind: 'operator' });
const noRole = () => hdr({ user_id: userA, business_id: bizA, role: null, token_kind: 'user' });
const memberA = () => hdr({ user_id: userA, business_id: bizA, role: 'owner', token_kind: 'user' });

const PATH = `/v1/businesses/${bizA}/invoices/${invId}/pdf`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .overrideProvider(ObjectStore)
    .useValue({ put: vi.fn(async () => 'http://fake/x') })
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

describe('media — cross-tenant isolation on the member PDF route', () => {
  it('→ 403 for a wrong-business context', async () => {
    expect((await http.get(PATH).set(wrongBusiness())).status).toBe(403);
  });
  it('→ 403 for an operator context', async () => {
    const res = await http.get(PATH).set(operator());
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('operator_data_access_denied');
  });
  it('→ 403 for a roleless context', async () => {
    expect((await http.get(PATH).set(noRole())).status).toBe(403);
  });
  it('the correct member is NOT blocked by the guard (202 — no document yet)', async () => {
    const res = await http.get(PATH).set(memberA());
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(202);
  });
});
