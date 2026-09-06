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

describe('sales — scaffold', () => {
  it('serves /healthz and /readyz', async () => {
    await http.get('/healthz').expect(200);
    await http.get('/readyz').expect(200);
  });

  it('has the five tenant tables under RLS (scoped access works, unscoped is empty)', async () => {
    const biz = uuidv7();
    await prisma.runInTenantContext(biz, async (tx) => {
      await tx.saleNumberCounter.create({
        data: { businessId: biz, nextNumber: 1 },
      });
      await tx.productCache.create({
        data: {
          businessId: biz,
          productId: uuidv7(),
          name: 'X',
          sellPrice: 100,
        },
      });
    });

    const scoped = await prisma.runInTenantContext(biz, (tx) =>
      tx.productCache.count(),
    );
    expect(scoped).toBe(1);

    // No tenant context → RLS hides the rows.
    expect(await prisma.productCache.count()).toBe(0);

    await prisma.runInTenantContext(biz, async (tx) => {
      await tx.productCache.deleteMany({});
      await tx.saleNumberCounter.deleteMany({});
    });
  });
});
