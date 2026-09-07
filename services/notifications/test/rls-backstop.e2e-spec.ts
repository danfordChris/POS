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

const STRICT: [string, (b: string) => string][] = [
  [
    'notification_contact',
    (b) =>
      `INSERT INTO notification_contact (business_id, user_id, role) VALUES ('${b}', '${uuidv7()}', 'owner')`,
  ],
];
// `notification` read is relaxed (the send worker scans all tenants); WITH CHECK strict.
const RELAXED: [string, (b: string) => string][] = [
  [
    'notification',
    (b) =>
      `INSERT INTO notification (business_id, type, payload) VALUES ('${b}', 'low_stock', '{}'::jsonb)`,
  ],
];

async function unscopedCount(table: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM ${table} WHERE business_id = '${bizA}'`,
  );
  return rows[0].n;
}
async function foreignCount(table: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${bizB}'`);
    const rows = await tx.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM ${table} WHERE business_id = '${bizA}'`,
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

  for (const [, insert] of [...STRICT, ...RELAXED]) {
    await prisma.runInTenantContext(bizA, (tx) =>
      tx.$executeRawUnsafe(insert(bizA)),
    );
  }
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM notification');
  await prisma.$executeRawUnsafe('DELETE FROM notification_contact');
  await app.close();
});

describe('notifications — RLS-only backstop', () => {
  for (const [table, insert] of STRICT) {
    it(`${table} (strict): unset app.business_id → 0 rows`, async () => {
      expect(await unscopedCount(table)).toBe(0);
    });
    it(`${table} (strict): a foreign app.business_id → 0 rows`, async () => {
      expect(await foreignCount(table)).toBe(0);
    });
    it(`${table}: a cross-tenant INSERT is rejected`, async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${bizB}'`);
          await tx.$executeRawUnsafe(insert(bizA));
        }),
      ).rejects.toThrow();
    });
  }
  for (const [table, insert] of RELAXED) {
    it(`${table} (relaxed read): unset app.business_id → rows ARE visible (documented)`, async () => {
      expect(await unscopedCount(table)).toBeGreaterThan(0);
    });
    it(`${table} (relaxed read): a foreign app.business_id → still 0 rows`, async () => {
      expect(await foreignCount(table)).toBe(0);
    });
    it(`${table}: a cross-tenant INSERT is still rejected`, async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${bizB}'`);
          await tx.$executeRawUnsafe(insert(bizA));
        }),
      ).rejects.toThrow();
    });
  }
});
