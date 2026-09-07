import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { uuidv7 } from 'uuidv7';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { SUBJECTS, makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { WingerAuthorizedConsumer } from '../src/winger/winger-authorized.consumer.js';
import { EMAIL_SENDER } from '../src/email/email-sender.js';
import { CaptureEmailSender } from '../src/email/capture-email-sender.js';

let app: INestApplication;
let prisma: PrismaService;
let consumer: WingerAuthorizedConsumer;
const email = new CaptureEmailSender();

const authorized = (over: Record<string, unknown> = {}) => {
  const biz = (over.business_id as string) ?? uuidv7();
  return makeEnvelope({
    producer: 'winger',
    businessId: biz,
    schemaVersion: '1.2.0',
    payload: {
      business_id: biz,
      winger_account_id: uuidv7(),
      user_id: uuidv7(),
      portal_url: 'https://app.example/winger',
      email: 'reseller@example.com',
      locale: 'sw',
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
  consumer = app.get(WingerAuthorizedConsumer);
});

afterEach(async () => {
  email.reset();
  await prisma.$executeRawUnsafe('DELETE FROM notification');
  await prisma.$executeRawUnsafe('DELETE FROM notification_business');
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await prisma.$executeRawUnsafe('DELETE FROM processed_events');
});

afterAll(async () => {
  await app.close();
});

describe('notifications — winger_authorized', () => {
  it('sends one localized email and records a sent notification', async () => {
    const evt = authorized();
    const biz = evt.payload.business_id;
    await prisma.notificationBusiness.create({
      data: { businessId: biz, name: 'Duka la Mama', locale: 'en' },
    });

    await consumer.onAuthorized(evt);

    const rows = await notifsFor(biz);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('winger_authorized');
    expect(rows[0].status).toBe('sent');

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toEqual(['reseller@example.com']);
    // locale on the event (sw) wins over the business default (en)
    expect(email.sent[0].subject).toContain(
      'Sasa unaweza kuuza kwa Duka la Mama',
    );
    expect(email.sent[0].text).toContain('https://app.example/winger');

    expect(
      await outboxFor(SUBJECTS.notifications.notificationSent),
    ).toHaveLength(1);
  });

  it('is idempotent on event_id and on winger_account_id', async () => {
    const evt = authorized();
    const biz = evt.payload.business_id;

    await consumer.onAuthorized(evt);
    await consumer.onAuthorized(evt); // same event_id
    await consumer.onAuthorized({ ...evt, event_id: uuidv7() }); // same winger_account_id

    expect(await notifsFor(biz)).toHaveLength(1);
    expect(email.sent).toHaveLength(1);
  });

  it('records a skipped notification and sends nothing when there is no email', async () => {
    const evt = authorized({ email: undefined });
    const biz = evt.payload.business_id;

    await consumer.onAuthorized(evt);

    const rows = await notifsFor(biz);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('skipped');
    expect(email.sent).toHaveLength(0);
  });

  it('falls back to English when the locale is unknown', async () => {
    const evt = authorized({ locale: 'fr' });
    await prisma.notificationBusiness.create({
      data: {
        businessId: evt.payload.business_id,
        name: 'Shop X',
        locale: 'en',
      },
    });

    await consumer.onAuthorized(evt);
    expect(email.sent[0].subject).toBe('You can now sell for Shop X');
  });
});
