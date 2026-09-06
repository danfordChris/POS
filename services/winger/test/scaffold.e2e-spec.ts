import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { uuidv7 } from 'uuidv7';
import {
  configureApp,
  registerNotFoundFallback,
  MESSAGE_BUS,
} from '@pos/nest-common';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

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
});

afterAll(async () => {
  await app.close();
});

describe('winger — scaffold', () => {
  it('serves /healthz and /readyz', async () => {
    await http.get('/healthz').expect(200);
    await http.get('/readyz').expect(200);
  });

  it('enforces tenant RLS on both tables', async () => {
    const biz = uuidv7();
    await prisma.runInTenantContext(biz, async (tx) => {
      await tx.wingerAccount.create({
        data: {
          businessId: biz,
          userId: uuidv7(),
          authorizedBy: uuidv7(),
        },
      });
      await tx.wingerCatalogProjection.create({
        data: {
          businessId: biz,
          productId: uuidv7(),
          name: 'X',
          sellPrice: 1000,
          currency: 'TZS',
        },
      });
    });

    const scoped = await prisma.runInTenantContext(biz, (tx) =>
      tx.wingerAccount.count(),
    );
    expect(scoped).toBe(1);

    // `winger_catalog_projection` read stays strictly scoped → unscoped sees nothing.
    expect(await prisma.wingerCatalogProjection.count()).toBe(0);
    // `winger_account` read is relaxed for the cross-tenant `GET /v1/winger/businesses`
    // path, but WRITE is still strictly scoped.
    await expect(
      prisma.wingerAccount.create({
        data: {
          businessId: uuidv7(),
          userId: uuidv7(),
          authorizedBy: uuidv7(),
        },
      }),
    ).rejects.toThrow();

    await prisma.runInTenantContext(biz, async (tx) => {
      await tx.wingerCatalogProjection.deleteMany({});
      await tx.wingerAccount.deleteMany({});
    });
  });
});
