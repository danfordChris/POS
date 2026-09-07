import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Every tenancy tenant table carries an intentional relaxed *read* path
 * (`control_plane_read` on `business` / `membership`; the unscoped-read policy on
 * `invitation` / `support_access_grant` / `audit_log`). The security-critical
 * invariant this asserts: a **foreign-scoped** read still isolates, and every
 * **cross-tenant write** is rejected by `WITH CHECK`.
 */
let app: INestApplication;
let prisma: PrismaService;

const bizA = randomUUID();
const bizB = randomUUID();
const future = new Date(Date.now() + 7 * 86_400_000).toISOString();

const SEED: [string, (b: string) => string][] = [
  ['business', (b) => `INSERT INTO business (id, name) VALUES ('${b}', 'Iso')`],
  [
    'membership',
    (b) =>
      `INSERT INTO membership (business_id, user_id, role) VALUES ('${b}', '${randomUUID()}', 'owner')`,
  ],
  [
    'invitation',
    (b) =>
      `INSERT INTO invitation (business_id, email, token_hash, expires_at, created_by) VALUES ('${b}', 'x@e.co', 'h-${randomUUID()}', '${future}', '${randomUUID()}')`,
  ],
  [
    'support_access_grant',
    (b) =>
      `INSERT INTO support_access_grant (business_id, operator_id, reason) VALUES ('${b}', '${randomUUID()}', 'r')`,
  ],
  [
    'audit_log',
    (b) =>
      `INSERT INTO audit_log (business_id, actor_id, actor_type, action) VALUES ('${b}', '${randomUUID()}', 'operator', 'a')`,
  ],
];

const keyCol = (table: string) => (table === 'business' ? 'id' : 'business_id');

async function foreignCount(table: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${bizB}'`);
    const rows = await tx.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM ${table} WHERE ${keyCol(table)} = '${bizA}'`,
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

  for (const [, insert] of SEED) {
    await prisma.runInTenantContext(bizA, (tx) =>
      tx.$executeRawUnsafe(insert(bizA)),
    );
  }
});

afterAll(async () => {
  for (const [table] of [...SEED].reverse()) {
    await prisma.runInTenantContext(bizA, (tx) =>
      tx.$executeRawUnsafe(
        `DELETE FROM ${table} WHERE ${keyCol(table)} = '${bizA}'`,
      ),
    );
  }
  await app.close();
});

describe('tenancy — RLS-only backstop', () => {
  for (const [table, insert] of SEED) {
    it(`${table}: a foreign app.business_id cannot see business A's rows`, async () => {
      expect(await foreignCount(table)).toBe(0);
    });
    it(`${table}: a cross-tenant INSERT (app.business_id = B, row = A) is rejected`, async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${bizB}'`);
          await tx.$executeRawUnsafe(insert(bizA));
        }),
      ).rejects.toThrow();
    });
  }

  it('an unscoped INSERT with no business_id is still rejected (WITH CHECK)', async () => {
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO business (name) VALUES ('sneaky')`),
    ).rejects.toThrow();
  });
});
