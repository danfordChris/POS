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
const saleA = uuidv7();
const custA = uuidv7();
const invA = uuidv7();

// business_id + every NOT NULL / no-default column. `sale_line` / `receipt` FK to `sale`.
const STRICT: [string, (b: string) => string][] = [
  [
    'sale_number_counter',
    (b) => `INSERT INTO sale_number_counter (business_id) VALUES ('${b}')`,
  ],
  [
    'product_cache',
    (b) =>
      `INSERT INTO product_cache (business_id, product_id, name) VALUES ('${b}', '${uuidv7()}', 'X')`,
  ],
  [
    'customer',
    (b) =>
      `INSERT INTO customer (id, business_id, name, updated_at) VALUES ('${custA}', '${b}', 'X', now())`,
  ],
];

// `sale` / `sale_line` / `receipt` have a relaxed read policy — the public
// `GET /v1/r/{token}` handler renders a receipt with no tenant context
// (migration 20260907140000). `invoice` / `invoice_line` are relaxed for the
// same reason on `GET /v1/i/{token}` (migrations 20260907160000 /
// 20260907170000). WITH CHECK stays strict on all of them.
const RELAXED: [string, (b: string) => string][] = [
  [
    'sale',
    (b) =>
      `INSERT INTO sale (id, business_id, number, subtotal, total, currency, sold_by) VALUES ('${saleA}', '${b}', 1, 100, 100, 'TZS', '${uuidv7()}')`,
  ],
  [
    'sale_line',
    (b) =>
      `INSERT INTO sale_line (sale_id, business_id, product_id, name_snapshot, unit_price_snapshot, quantity, line_total) VALUES ('${saleA}', '${b}', '${uuidv7()}', 'X', 100, 1, 100)`,
  ],
  [
    'receipt',
    (b) =>
      `INSERT INTO receipt (business_id, sale_id, public_token, business_name_snapshot, currency) VALUES ('${b}', '${saleA}', 'tok-${uuidv7()}', 'Shop', 'TZS')`,
  ],
  [
    'invoice',
    (b) =>
      `INSERT INTO invoice (id, business_id, number, customer_id, currency, subtotal_minor, total_minor, balance_due_minor, issue_date, due_date, public_token, business_name_snapshot, customer_name_snapshot) VALUES ('${invA}', '${b}', 1, '${custA}', 'TZS', 100, 100, 100, now(), now(), 'itok-${uuidv7()}', 'Shop', 'X')`,
  ],
  [
    'invoice_line',
    (b) =>
      `INSERT INTO invoice_line (invoice_id, business_id, description, quantity, unit_price_minor, line_total_minor) VALUES ('${invA}', '${b}', 'X', 1, 100, 100)`,
  ],
];

// `payment` FKs to `invoice`, so it is seeded after RELAXED. Strict policy.
const STRICT_AFTER: [string, (b: string) => string][] = [
  [
    'payment',
    (b) =>
      `INSERT INTO payment (business_id, invoice_id, amount_minor, method, received_at, created_by) VALUES ('${b}', '${invA}', 100, 'cash', now(), '${uuidv7()}')`,
  ],
];

// Scoped to business A's seeded rows so a concurrent spec's data can't skew it.
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

  for (const [, insert] of [...STRICT, ...RELAXED, ...STRICT_AFTER]) {
    await prisma.runInTenantContext(bizA, (tx) =>
      tx.$executeRawUnsafe(insert(bizA)),
    );
  }
});

afterAll(async () => {
  for (const [table] of [
    ...STRICT_AFTER,
    ...[...RELAXED].reverse(),
    ...[...STRICT].reverse(),
  ]) {
    await prisma.runInTenantContext(bizA, (tx) =>
      tx.$executeRawUnsafe(`DELETE FROM ${table}`),
    );
  }
  await app.close();
});

describe('sales — RLS-only backstop', () => {
  for (const [table, insert] of [...STRICT, ...STRICT_AFTER]) {
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
