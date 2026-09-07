import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { uuidv7 } from 'uuidv7';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InvitationConsumer } from '../src/invitations/invitation.consumer.js';
import { EMAIL_SENDER } from '../src/email/email-sender.js';
import { CaptureEmailSender } from '../src/email/capture-email-sender.js';

let app: INestApplication;
let prisma: PrismaService;
let consumer: InvitationConsumer;
const email = new CaptureEmailSender();

const created = (over: Record<string, unknown> = {}) => {
  const biz = (over.business_id as string) ?? uuidv7();
  return makeEnvelope({
    producer: 'tenancy',
    businessId: biz,
    schemaVersion: '1.2.0',
    payload: {
      business_id: biz,
      invitation_id: uuidv7(),
      email: 'invitee@example.com',
      role: 'staff' as const,
      accept_url: 'https://app.example/invitations/accept?token=abc123def456',
      expires_at: '2026-09-20T00:00:00.000Z',
      business_name: 'Duka la Mama',
      locale: 'sw',
      ...over,
    },
  });
};

const notifsFor = (businessId: string) =>
  prisma.runInTenantContext(businessId, (tx) =>
    tx.notification.findMany({ where: { businessId } }),
  );

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
  consumer = app.get(InvitationConsumer);
});

afterEach(async () => {
  email.reset();
  await prisma.$executeRawUnsafe('DELETE FROM notification');
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await prisma.$executeRawUnsafe('DELETE FROM processed_events');
});

afterAll(async () => {
  await app.close();
});

describe('notifications — invitation email', () => {
  it('sends one localized email and records a sent notification', async () => {
    const evt = created();
    const biz = evt.payload.business_id;

    await consumer.onCreated(evt);

    const rows = await notifsFor(biz);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('invitation');
    expect(rows[0].status).toBe('sent');

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toEqual(['invitee@example.com']);
    expect(email.sent[0].subject).toContain('Jiunge na Duka la Mama'); // sw
    expect(email.sent[0].text).toContain(
      'https://app.example/invitations/accept?token=abc123def456',
    );
  });

  it('is idempotent on event_id and on invitation_id', async () => {
    const evt = created();
    const biz = evt.payload.business_id;

    await consumer.onCreated(evt);
    await consumer.onCreated(evt); // same event_id
    await consumer.onCreated({ ...evt, event_id: uuidv7() }); // same invitation_id

    expect(await notifsFor(biz)).toHaveLength(1);
    expect(email.sent).toHaveLength(1);
  });

  it('falls back to English when the locale is unknown', async () => {
    const evt = created({ locale: 'fr' });
    await consumer.onCreated(evt);
    expect(email.sent[0].subject).toBe('Join Duka la Mama on Stoki');
  });
});
