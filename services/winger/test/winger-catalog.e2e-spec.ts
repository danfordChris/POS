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
const wingerUser = uuidv7();
const strangerUser = uuidv7();

function userCtx(userId: string) {
  const { header, signature } = signInternalContext(
    {
      request_id: `t-${uuidv7()}`,
      user_id: userId,
      business_id: null,
      role: null,
      token_kind: 'user',
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

async function seedAccount(
  businessId: string,
  userId: string,
  status = 'active',
) {
  await prisma.runInTenantContext(businessId, (tx) =>
    tx.wingerAccount.create({
      data: { businessId, userId, authorizedBy: uuidv7(), status },
    }),
  );
}

async function seedProduct(
  businessId: string,
  over: Partial<{
    name: string;
    imageUrl: string | null;
    sellPrice: number;
    wingerPrice: number | null;
    onHand: number;
    isActive: boolean;
  }> = {},
) {
  await prisma.runInTenantContext(businessId, (tx) =>
    tx.wingerCatalogProjection.create({
      data: {
        businessId,
        productId: uuidv7(),
        name: over.name ?? 'Sukari 1kg',
        imageUrl: over.imageUrl ?? null,
        sellPrice: over.sellPrice ?? 3000,
        wingerPrice: over.wingerPrice ?? null,
        currency: 'TZS',
        onHand: over.onHand ?? 5,
        isActive: over.isActive ?? true,
      },
    }),
  );
}

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

  await prisma.wingerBusiness.createMany({
    data: [
      { businessId: bizA, name: 'Alpha Store', currency: 'TZS' },
      { businessId: bizB, name: 'Beta Store', currency: 'TZS' },
    ],
  });
  await seedAccount(bizA, wingerUser, 'active');
  await seedAccount(bizB, wingerUser, 'suspended');
  await seedProduct(bizA, {
    name: 'Retail-priced',
    sellPrice: 3000,
    wingerPrice: null,
    onHand: 5,
  });
  await seedProduct(bizA, {
    name: 'Winger-priced',
    sellPrice: 3000,
    wingerPrice: 2400,
    onHand: 0,
  });
  await seedProduct(bizA, { name: 'Inactive', isActive: false });
});

afterAll(async () => {
  for (const b of [bizA, bizB]) {
    await prisma.runInTenantContext(b, async (tx) => {
      await tx.wingerCatalogProjection.deleteMany({});
      await tx.wingerAccount.deleteMany({});
    });
  }
  await prisma.wingerBusiness.deleteMany({});
  await app.close();
});

describe('winger catalog — reader endpoints', () => {
  it('GET /winger/businesses lists only ACTIVE winger businesses, with names', async () => {
    const { body } = await http
      .get('/v1/winger/businesses')
      .set(userCtx(wingerUser))
      .expect(200);
    expect(body).toEqual([{ business_id: bizA, business_name: 'Alpha Store' }]);
  });

  it('GET /winger/businesses is empty for a non-winger', async () => {
    const { body } = await http
      .get('/v1/winger/businesses')
      .set(userCtx(strangerUser))
      .expect(200);
    expect(body).toEqual([]);
  });

  it('GET products returns ONLY the whitelist keys', async () => {
    const { body } = await http
      .get(`/v1/winger/businesses/${bizA}/products`)
      .set(userCtx(wingerUser))
      .expect(200);

    expect(body.data.length).toBe(2); // inactive excluded
    for (const p of body.data) {
      expect(Object.keys(p).sort()).toEqual(
        ['currency', 'image_url', 'in_stock', 'name', 'price'].sort(),
      );
    }
  });

  it('price = winger_price ?? sell_price; in_stock = on_hand > 0', async () => {
    const { body } = await http
      .get(`/v1/winger/businesses/${bizA}/products`)
      .set(userCtx(wingerUser))
      .expect(200);

    const retail = body.data.find(
      (p: { name: string }) => p.name === 'Retail-priced',
    );
    const winger = body.data.find(
      (p: { name: string }) => p.name === 'Winger-priced',
    );
    expect(retail).toMatchObject({ price: 3000, in_stock: true });
    expect(winger).toMatchObject({ price: 2400, in_stock: false });
  });

  it('non-authorized business_id → 403 winger_scope_denied', async () => {
    const { body } = await http
      .get(`/v1/winger/businesses/${uuidv7()}/products`)
      .set(userCtx(wingerUser))
      .expect(403);
    expect(body.error.code).toBe('winger_scope_denied');
  });

  it('suspended account → 403 on products', async () => {
    const { body } = await http
      .get(`/v1/winger/businesses/${bizB}/products`)
      .set(userCtx(wingerUser))
      .expect(403);
    expect(body.error.code).toBe('winger_scope_denied');
  });

  it('rejects a missing internal context (Kong guarantees it; service treats absence as 500)', async () => {
    const { body } = await http.get('/v1/winger/businesses').expect(500);
    expect(body.error.code).toBe('internal_context_invalid');
  });

  it('paginates with a cursor', async () => {
    const first = await http
      .get(`/v1/winger/businesses/${bizA}/products?limit=1`)
      .set(userCtx(wingerUser))
      .expect(200);
    expect(first.body.data.length).toBe(1);
    expect(first.body.next_cursor).toBeTruthy();

    const second = await http
      .get(
        `/v1/winger/businesses/${bizA}/products?limit=1&cursor=${first.body.next_cursor}`,
      )
      .set(userCtx(wingerUser))
      .expect(200);
    expect(second.body.data.length).toBe(1);
    expect(second.body.data[0].name).not.toBe(first.body.data[0].name);
  });
});
