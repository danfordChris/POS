import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { uuidv7 } from 'uuidv7';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { SUBJECTS, makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { LowStockConsumer } from '../src/low-stock/low-stock.consumer.js';
import { ContactProjectionConsumer } from '../src/contacts/contact-projection.consumer.js';
import { SendWorker } from '../src/low-stock/send-worker.js';
import { EMAIL_SENDER } from '../src/email/email-sender.js';
import { CaptureEmailSender } from '../src/email/capture-email-sender.js';

let app: INestApplication;
let prisma: PrismaService;
let consumer: LowStockConsumer;
let contacts: ContactProjectionConsumer;
let worker: SendWorker;
const email = new CaptureEmailSender();

const T = '2026-09-06T12:00:00.000Z';

const fellBelow = (over: Record<string, unknown> = {}) => {
  const biz = uuidv7();
  const product = uuidv7();
  return makeEnvelope({
    producer: 'inventory',
    businessId: biz,
    schemaVersion: '1.1.0',
    payload: {
      business_id: biz,
      product_id: product,
      on_hand: 2,
      threshold: 5,
      opened_at: T,
      recipients: ['ops@shop.co.tz'],
      ...over,
    },
  });
};

const notifsFor = (businessId: string) =>
  prisma.runInTenantContext(businessId, (tx) =>
    tx.notification.findMany({ where: { businessId } }),
  );
const outboxFor = (subject: string) =>
  prisma.outboxMessage.findMany({ where: { subject } });

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .overrideProvider(EMAIL_SENDER)
    .useValue(email)
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  prisma = app.get(PrismaService);
  consumer = app.get(LowStockConsumer);
  contacts = app.get(ContactProjectionConsumer);
  worker = app.get(SendWorker);
});

afterEach(async () => {
  email.reset();
  await prisma.$executeRawUnsafe('DELETE FROM notification');
  await prisma.$executeRawUnsafe('DELETE FROM notification_contact');
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await prisma.$executeRawUnsafe('DELETE FROM processed_events');
});

afterAll(async () => {
  await app.close();
});

describe('notifications — low-stock consumer', () => {
  it('creates one queued notification per window; event_id and dedupe_key both dedupe', async () => {
    const evt = fellBelow();
    const biz = evt.payload.business_id;

    await consumer.onFellBelow(evt);
    await consumer.onFellBelow(evt); // same event_id
    await consumer.onFellBelow({ ...evt, event_id: uuidv7() }); // same window

    const rows = await notifsFor(biz);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('queued');
    expect(rows[0].dedupeKey).toBe(
      `low_stock:${biz}:${evt.payload.product_id}:${T}`,
    );
  });

  it('uses the event recipients when present', async () => {
    const evt = fellBelow({ recipients: ['a@x.com', 'b@x.com'] });
    await consumer.onFellBelow(evt);
    const [row] = await notifsFor(evt.payload.business_id);
    expect((row.payload as any).recipients).toEqual(['a@x.com', 'b@x.com']);
  });

  it('falls back to active-owner emails when recipients is empty', async () => {
    const biz = uuidv7();
    const owner = uuidv7();
    await contacts.onBusinessCreated(
      makeEnvelope({
        producer: 'tenancy',
        businessId: biz,
        schemaVersion: '1.1.0',
        payload: {
          business_id: biz,
          name: 'Shop',
          currency: 'TZS',
          locale: 'en',
          owner_user_id: owner,
          owner_email: 'owner@shop.co.tz',
        },
      }),
    );
    await consumer.onFellBelow(
      makeEnvelope({
        producer: 'inventory',
        businessId: biz,
        schemaVersion: '1.1.0',
        payload: {
          business_id: biz,
          product_id: uuidv7(),
          on_hand: 1,
          threshold: 4,
          opened_at: T,
          recipients: [],
        },
      }),
    );
    const [row] = await notifsFor(biz);
    expect((row.payload as any).recipients).toEqual(['owner@shop.co.tz']);
  });

  it('StockRecovered supersedes the still-queued notification for that window', async () => {
    const evt = fellBelow();
    await consumer.onFellBelow(evt);
    await consumer.onRecovered(
      makeEnvelope({
        producer: 'inventory',
        businessId: evt.payload.business_id,
        schemaVersion: '1.1.0',
        payload: {
          business_id: evt.payload.business_id,
          product_id: evt.payload.product_id,
          on_hand: 9,
          opened_at: T,
        },
      }),
    );
    const [row] = await notifsFor(evt.payload.business_id);
    expect(row.status).toBe('superseded');

    await worker.tick();
    expect(email.sent).toHaveLength(0);
  });
});

describe('notifications — send worker', () => {
  it('sends a queued notification, marks it sent, emits NotificationSent', async () => {
    const evt = fellBelow();
    await consumer.onFellBelow(evt);

    const touched = await worker.tick();
    expect(touched).toBe(1);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toEqual(['ops@shop.co.tz']);

    const [row] = await notifsFor(evt.payload.business_id);
    expect(row.status).toBe('sent');
    expect(row.sentAt).toBeInstanceOf(Date);
    expect(
      await outboxFor(SUBJECTS.notifications.notificationSent),
    ).toHaveLength(1);
  });

  it('retries a failing send up to 3×, then stays failed and emits NotificationFailed', async () => {
    email.failNext = 10;
    const evt = fellBelow();
    await consumer.onFellBelow(evt);
    const biz = evt.payload.business_id;

    await worker.tick();
    expect((await notifsFor(biz))[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
    });
    expect(
      await outboxFor(SUBJECTS.notifications.notificationFailed),
    ).toHaveLength(0);

    await worker.tick();
    expect((await notifsFor(biz))[0].attempts).toBe(2);

    await worker.tick();
    expect((await notifsFor(biz))[0]).toMatchObject({
      status: 'failed',
      attempts: 3,
    });
    expect(
      await outboxFor(SUBJECTS.notifications.notificationFailed),
    ).toHaveLength(1);

    const before = email.failNext;
    const touched = await worker.tick();
    expect(touched).toBe(0); // attempts == 3, not retried
    expect(email.failNext).toBe(before);
  });

  it('marks failed with no retry when no recipients resolve', async () => {
    const biz = uuidv7();
    await consumer.onFellBelow(
      makeEnvelope({
        producer: 'inventory',
        businessId: biz,
        schemaVersion: '1.1.0',
        payload: {
          business_id: biz,
          product_id: uuidv7(),
          on_hand: 1,
          threshold: 3,
          opened_at: T,
          recipients: [],
        },
      }),
    );
    await worker.tick();
    const [row] = await notifsFor(biz);
    expect(row).toMatchObject({ status: 'failed', attempts: 3 });
    expect(row.lastError).toContain('no recipients');
  });
});
