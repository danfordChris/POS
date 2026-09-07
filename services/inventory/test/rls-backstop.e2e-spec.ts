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
    'stock_item',
    (b) =>
      `INSERT INTO stock_item (business_id, product_id) VALUES ('${b}', '${uuidv7()}')`,
  ],
  [
    'stock_movement',
    (b) =>
      `INSERT INTO stock_movement (business_id, product_id, type, quantity_delta) VALUES ('${b}', '${uuidv7()}', 'stock_in', 1)`,
  ],
  [
    'low_stock_alert_state',
    (b) =>
      `INSERT INTO low_stock_alert_state (business_id, product_id) VALUES ('${b}', '${uuidv7()}')`,
  ],
  [
    'stock_reservation',
    (b) =>
      `INSERT INTO stock_reservation (id, business_id, lines) VALUES ('${uuidv7()}', '${b}', '[]'::jsonb)`,
  ],
  [
    'alert_config',
    (b) => `INSERT INTO alert_config (business_id) VALUES ('${b}')`,
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

describe('inventory — RLS-only backstop', () => {
  for (const [table, insert] of STRICT) {
    it(`${table}: unset app.business_id → 0 rows`, async () => {
      expect(await unscopedCount(table)).toBe(0);
    });
    it(`${table}: a foreign app.business_id → 0 rows`, async () => {
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

  it('a scoped read still sees its own rows (control)', async () => {
    const n = await prisma.runInTenantContext(bizA, (tx) =>
      tx.stockItem.count(),
    );
    expect(n).toBeGreaterThan(0);
  });
});
