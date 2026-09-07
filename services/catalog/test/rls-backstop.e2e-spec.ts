import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { uuidv7 } from 'uuidv7';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * RLS-only backstop: with the application tenant filter bypassed (raw SQL, no
 * `app.business_id`), Postgres Row-Level Security must leak zero rows across
 * tenants for every strictly-scoped table, and reject every cross-tenant write.
 */
let app: INestApplication;
let prisma: PrismaService;

const bizA = uuidv7();
const bizB = uuidv7();

// [table, INSERT for a given business] — business_id + every NOT NULL / no-default column.
const STRICT: [string, (b: string) => string][] = [
  [
    'product',
    (b) =>
      `INSERT INTO product (business_id, sku, name) VALUES ('${b}', 'SKU-${uuidv7()}', 'X')`,
  ],
  [
    'category',
    (b) => `INSERT INTO category (business_id, name) VALUES ('${b}', 'C')`,
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

  for (const [, insert] of STRICT) {
    await prisma.runInTenantContext(bizA, (tx) =>
      tx.$executeRawUnsafe(insert(bizA)),
    );
  }
});

afterAll(async () => {
  for (const [table] of STRICT) {
    await prisma.runInTenantContext(bizA, (tx) =>
      tx.$executeRawUnsafe(`DELETE FROM ${table}`),
    );
  }
  await app.close();
});

describe('catalog — RLS-only backstop', () => {
  for (const [table, insert] of STRICT) {
    it(`${table}: unset app.business_id → 0 rows`, async () => {
      expect(await unscopedCount(table)).toBe(0);
    });
    it(`${table}: a foreign app.business_id → 0 rows`, async () => {
      expect(await foreignCount(table)).toBe(0);
    });
    it(`${table}: a cross-tenant INSERT (app.business_id = B, row business_id = A) is rejected`, async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${bizB}'`);
          await tx.$executeRawUnsafe(insert(bizA));
        }),
      ).rejects.toThrow();
    });
  }

  it('a scoped read still sees its own rows (control)', async () => {
    const n = await prisma.runInTenantContext(bizA, (tx) => tx.product.count());
    expect(n).toBeGreaterThan(0);
  });
});
