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
import { DigestConfigConsumer } from '../src/digest/digest-config.consumer.js';
import { DigestFlushJob } from '../src/digest/digest-flush.job.js';
import { EMAIL_SENDER } from '../src/email/email-sender.js';
import { CaptureEmailSender } from '../src/email/capture-email-sender.js';

let app: INestApplication;
let prisma: PrismaService;
let consumer: LowStockConsumer;
let contacts: ContactProjectionConsumer;
let digestConfig: DigestConfigConsumer;
let job: DigestFlushJob;
const email = new CaptureEmailSender();

const T = '2026-09-06T12:00:00.000Z';
const HOUR = 3_600_000;
const dueLater = () => new Date(Date.now() + 25 * HOUR);

const fellBelow = (over: Record<string, unknown> = {}) => {
  const biz = (over.business_id as string) ?? uuidv7();
  return makeEnvelope({
    producer: 'inventory',
    businessId: biz,
    schemaVersion: '1.1.0',
    payload: {
      business_id: biz,
      product_id: uuidv7(),
      on_hand: 2,
      threshold: 5,
      opened_at: T,
      recipients: ['ops@shop.co.tz'],
      ...over,
    },
  });
};

const recoveredFor = (fell: ReturnType<typeof fellBelow>) =>
  makeEnvelope({
    producer: 'inventory',
    businessId: fell.payload.business_id,
    schemaVersion: '1.1.0',
    payload: {
      business_id: fell.payload.business_id,
      product_id: fell.payload.product_id,
      on_hand: 9,
      opened_at: fell.payload.opened_at,
    },
  });

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
  digestConfig = app.get(DigestConfigConsumer);
  job = app.get(DigestFlushJob);
});

afterEach(async () => {
  email.reset();
  await prisma.$executeRawUnsafe('DELETE FROM notification');
  await prisma.$executeRawUnsafe('DELETE FROM notification_contact');
  await prisma.$executeRawUnsafe('DELETE FROM notification_business');
  await prisma.$executeRawUnsafe('DELETE FROM digest_config');
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
          owner_user_id: uuidv7(),
          owner_email: 'owner@shop.co.tz',
        },
      }),
    );
    await consumer.onFellBelow(fellBelow({ business_id: biz, recipients: [] }));
    const [row] = await notifsFor(biz);
    expect((row.payload as any).recipients).toEqual(['owner@shop.co.tz']);
  });

  it('StockRecovered supersedes the still-queued notification for that window', async () => {
    const evt = fellBelow();
    await consumer.onFellBelow(evt);
    await consumer.onRecovered(recoveredFor(evt));
    const [row] = await notifsFor(evt.payload.business_id);
    expect(row.status).toBe('superseded');

    await job.tick(dueLater());
    expect(email.sent).toHaveLength(0);
  });
});

describe('notifications — digest flush', () => {
  it('batches every currently-low product of a business into one due digest', async () => {
    const biz = uuidv7();
    const a = fellBelow({ business_id: biz });
    const b = fellBelow({ business_id: biz });
    await consumer.onFellBelow(a);
    await consumer.onFellBelow(b);

    expect(await job.tick(new Date())).toBe(0); // window not yet due
    expect(email.sent).toHaveLength(0);

    expect(await job.tick(dueLater())).toBe(1);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toEqual(['ops@shop.co.tz']);
    expect(email.sent[0].text).toContain(a.payload.product_id);
    expect(email.sent[0].text).toContain(b.payload.product_id);

    const rows = await notifsFor(biz);
    expect(rows.every((r) => r.status === 'sent')).toBe(true);
    expect(
      await outboxFor(SUBJECTS.notifications.notificationSent),
    ).toHaveLength(2);
  });

  it('renders the digest in the business locale from BusinessCreated', async () => {
    const biz = uuidv7();
    await contacts.onBusinessCreated(
      makeEnvelope({
        producer: 'tenancy',
        businessId: biz,
        schemaVersion: '1.1.0',
        payload: {
          business_id: biz,
          name: 'Duka la Mama',
          currency: 'TZS',
          locale: 'sw',
          owner_user_id: uuidv7(),
          owner_email: 'mama@duka.co.tz',
        },
      }),
    );
    await consumer.onFellBelow(fellBelow({ business_id: biz }));
    await job.tick(dueLater());

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].subject).toContain('inakaribia kuisha');
    expect(email.sent[0].text).toContain('Duka la Mama');
    expect(email.sent[0].text).toContain('agiza upya');
    expect(email.sent[0].html).toContain('<li>');
  });

  it('drops a recovered product from the digest and leaves it superseded', async () => {
    const biz = uuidv7();
    const keep = fellBelow({ business_id: biz });
    const gone = fellBelow({ business_id: biz });
    await consumer.onFellBelow(keep);
    await consumer.onFellBelow(gone);
    await consumer.onRecovered(recoveredFor(gone));

    await job.tick(dueLater());

    const rows = await notifsFor(biz);
    const goneRow = rows.find(
      (r) => (r.payload as any).product_id === gone.payload.product_id,
    );
    const keepRow = rows.find(
      (r) => (r.payload as any).product_id === keep.payload.product_id,
    );
    expect(goneRow?.status).toBe('superseded');
    expect(keepRow?.status).toBe('sent');
    expect(email.sent[0].text).not.toContain(gone.payload.product_id);
  });

  it('opens a fresh window after a flush', async () => {
    const biz = uuidv7();
    await consumer.onFellBelow(fellBelow({ business_id: biz }));
    await job.tick(dueLater());
    expect(email.sent).toHaveLength(1);

    await consumer.onFellBelow(fellBelow({ business_id: biz }));
    expect(await job.tick(new Date())).toBe(0); // new window, not due
    expect(await job.tick(dueLater())).toBe(1);
    expect(email.sent).toHaveLength(2);
  });

  it('sends one email when two flushes race the same due window', async () => {
    const biz = uuidv7();
    await consumer.onFellBelow(fellBelow({ business_id: biz }));
    await consumer.onFellBelow(fellBelow({ business_id: biz }));

    const when = dueLater();
    await Promise.all([job.tick(when), job.tick(when)]);
    expect(email.sent).toHaveLength(1);
    expect((await notifsFor(biz)).every((r) => r.status === 'sent')).toBe(true);
  });

  it('honours a per-business min_interval_hours from AlertConfigChanged', async () => {
    const fast = uuidv7();
    const slow = uuidv7();
    await digestConfig.onChanged(
      makeEnvelope({
        producer: 'inventory',
        businessId: fast,
        schemaVersion: '1.1.0',
        payload: {
          business_id: fast,
          min_interval_hours: 1,
          recipients: ['x@x.com'],
        },
      }),
    );
    await consumer.onFellBelow(fellBelow({ business_id: fast }));
    await consumer.onFellBelow(fellBelow({ business_id: slow }));

    const inTwoHours = new Date(Date.now() + 2 * HOUR);
    expect(await job.tick(inTwoHours)).toBe(1); // only `fast` is due
    expect((await notifsFor(fast)).every((r) => r.status === 'sent')).toBe(
      true,
    );
    expect((await notifsFor(slow)).every((r) => r.status === 'queued')).toBe(
      true,
    );
  });

  it('retries a failing digest up to 3×, then fails terminally', async () => {
    email.failNext = 10;
    const biz = uuidv7();
    await consumer.onFellBelow(fellBelow({ business_id: biz }));

    await job.tick(dueLater());
    expect((await notifsFor(biz))[0]).toMatchObject({
      status: 'queued',
      attempts: 1,
    });

    await job.tick(dueLater());
    expect((await notifsFor(biz))[0].attempts).toBe(2);

    await job.tick(dueLater());
    expect((await notifsFor(biz))[0]).toMatchObject({
      status: 'failed',
      attempts: 3,
    });
    expect(
      await outboxFor(SUBJECTS.notifications.notificationFailed),
    ).toHaveLength(1);
  });

  it('fails terminally with no retry when no recipients resolve', async () => {
    const biz = uuidv7();
    await consumer.onFellBelow(fellBelow({ business_id: biz, recipients: [] }));
    await job.tick(dueLater());
    const [row] = await notifsFor(biz);
    expect(row).toMatchObject({ status: 'failed', attempts: 3 });
    expect(row.lastError).toContain('no recipients');
  });
});
