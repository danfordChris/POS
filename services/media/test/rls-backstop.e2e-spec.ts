import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { uuidv7 } from 'uuidv7';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;

const bizA = uuidv7();
const bizB = uuidv7();
const refA = uuidv7();

const insertDoc = (b: string) =>
  `INSERT INTO document (business_id, kind, ref_id, public_token, url, bytes, sha256, snapshot, updated_at)
   VALUES ('${b}', 'invoice', '${refA}', 'dtok-${uuidv7()}', 'http://x', 1, 'h', '{}'::jsonb, now())`;

async function unscopedCount(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM document WHERE business_id = '${bizA}'`,
  );
  return rows[0].n;
}
async function foreignCount(): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${bizB}'`);
    const rows = await tx.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM document WHERE business_id = '${bizA}'`,
    );
    return rows[0].n;
  });
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.runInTenantContext(bizA, (tx) => tx.$executeRawUnsafe(insertDoc(bizA)));
});

afterAll(async () => {
  await prisma.runInTenantContext(bizA, (tx) => tx.$executeRawUnsafe(`DELETE FROM document`));
  await app.close();
});

describe('media — RLS-only backstop (document)', () => {
  it('relaxed read: unset app.business_id → the row IS visible (public /pdf by token)', async () => {
    expect(await unscopedCount()).toBeGreaterThan(0);
  });

  it('relaxed read: a foreign app.business_id → still 0 rows', async () => {
    expect(await foreignCount()).toBe(0);
  });

  it('a cross-tenant INSERT is rejected (WITH CHECK stays strict)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${bizB}'`);
        await tx.$executeRawUnsafe(insertDoc(bizA));
      }),
    ).rejects.toThrow();
  });
});
