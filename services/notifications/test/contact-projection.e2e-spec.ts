import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { uuidv7 } from 'uuidv7';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ContactProjectionConsumer } from '../src/contacts/contact-projection.consumer.js';

let app: INestApplication;
let prisma: PrismaService;
let consumer: ContactProjectionConsumer;

const biz = uuidv7();
const owner = uuidv7();
const staff = uuidv7();

const businessCreated = (over: Record<string, unknown> = {}) =>
  makeEnvelope({
    producer: 'tenancy',
    businessId: biz,
    schemaVersion: '1.1.0',
    payload: {
      business_id: biz,
      name: 'Duka',
      currency: 'TZS',
      locale: 'sw',
      owner_user_id: owner,
      owner_email: 'owner@duka.co.tz',
      owner_locale: 'sw',
      ...over,
    },
  });

const membershipCreated = (
  userId: string,
  over: Record<string, unknown> = {},
) =>
  makeEnvelope({
    producer: 'tenancy',
    businessId: biz,
    schemaVersion: '1.1.0',
    payload: {
      business_id: biz,
      user_id: userId,
      role: 'staff',
      email: 'staff@duka.co.tz',
      locale: 'en',
      ...over,
    },
  });

const membershipSuspended = (userId: string) =>
  makeEnvelope({
    producer: 'tenancy',
    businessId: biz,
    schemaVersion: '1.1.0',
    payload: { business_id: biz, user_id: userId },
  });

const contact = (userId: string) =>
  prisma.runInTenantContext(biz, (tx) =>
    tx.notificationContact.findUnique({
      where: { businessId_userId: { businessId: biz, userId } },
    }),
  );

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  prisma = app.get(PrismaService);
  consumer = app.get(ContactProjectionConsumer);
});

afterAll(async () => {
  await prisma.runInTenantContext(biz, (tx) =>
    tx.notificationContact.deleteMany({}),
  );
  await prisma.$executeRawUnsafe(`DELETE FROM processed_events`);
  await app.close();
});

describe('notifications — contact projection', () => {
  it('BusinessCreated seeds the owner contact (active, role owner)', async () => {
    await consumer.onBusinessCreated(businessCreated());
    const c = await contact(owner);
    expect(c).toMatchObject({
      role: 'owner',
      email: 'owner@duka.co.tz',
      locale: 'sw',
      active: true,
    });
  });

  it('MembershipCreated then a role/email change keep exactly one row', async () => {
    await consumer.onMembershipCreated(membershipCreated(staff));
    await consumer.onMembershipCreated(
      membershipCreated(staff, { role: 'owner', email: 'promoted@duka.co.tz' }),
    );
    const rows = await prisma.runInTenantContext(biz, (tx) =>
      tx.notificationContact.findMany({ where: { userId: staff } }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      role: 'owner',
      email: 'promoted@duka.co.tz',
      active: true,
    });
  });

  it('re-delivering the same event_id changes nothing', async () => {
    const evt = membershipCreated(uuidv7(), { email: 'dupe@duka.co.tz' });
    await consumer.onMembershipCreated(evt);
    await consumer.onMembershipCreated(evt);
    const n = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM processed_events WHERE event_id = $1::uuid`,
      evt.event_id,
    );
    expect(Number(n[0].n)).toBe(1);
  });

  it('MembershipSuspended deactivates; a later MembershipCreated reactivates', async () => {
    await consumer.onMembershipSuspended(membershipSuspended(staff));
    expect((await contact(staff))?.active).toBe(false);

    await consumer.onMembershipCreated(
      membershipCreated(staff, { role: 'staff' }),
    );
    expect((await contact(staff))?.active).toBe(true);
  });

  it('tolerates BusinessCreated without owner_email (falls back to business locale)', async () => {
    const b2 = uuidv7();
    const o2 = uuidv7();
    await consumer.onBusinessCreated(
      makeEnvelope({
        producer: 'tenancy',
        businessId: b2,
        schemaVersion: '1.1.0',
        payload: {
          business_id: b2,
          name: 'X',
          currency: 'TZS',
          locale: 'en',
          owner_user_id: o2,
        },
      }),
    );
    const c = await prisma.runInTenantContext(b2, (tx) =>
      tx.notificationContact.findUnique({
        where: { businessId_userId: { businessId: b2, userId: o2 } },
      }),
    );
    expect(c).toMatchObject({ role: 'owner', email: null, locale: 'en' });
    await prisma.runInTenantContext(b2, (tx) =>
      tx.notificationContact.deleteMany({}),
    );
  });
});
