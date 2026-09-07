import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { uuidv7 } from 'uuidv7';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ContactProjectionConsumer } from '../src/contacts/contact-projection.consumer.js';
import {
  NotifInvoiceIssuedConsumer,
  NotifInvoicePaymentConsumer,
  NotifInvoiceVoidedConsumer,
} from '../src/invoices/invoice.consumers.js';
import { OverdueSweepJob } from '../src/invoices/overdue-sweep.job.js';
import { EMAIL_SENDER } from '../src/email/email-sender.js';
import { CaptureEmailSender } from '../src/email/capture-email-sender.js';

let app: INestApplication;
let prisma: PrismaService;
let contacts: ContactProjectionConsumer;
let issued: NotifInvoiceIssuedConsumer;
let paid: NotifInvoicePaymentConsumer;
let voided: NotifInvoiceVoidedConsumer;
let sweep: OverdueSweepJob;
const email = new CaptureEmailSender();

const DAY = 86_400_000;

function seedBusiness(
  businessId: string,
  ownerEmail = 'owner@shop.io',
  locale = 'sw',
) {
  return contacts.onBusinessCreated(
    makeEnvelope({
      producer: 'tenancy',
      businessId,
      schemaVersion: '1.2.0',
      payload: {
        business_id: businessId,
        name: 'Duka la Asha',
        currency: 'TZS',
        locale,
        owner_user_id: uuidv7(),
        owner_email: ownerEmail,
        owner_locale: locale,
      },
    }),
  );
}

function issuedEvent(over: Record<string, unknown> = {}) {
  const businessId = (over.business_id as string) ?? uuidv7();
  return makeEnvelope({
    producer: 'sales',
    businessId,
    schemaVersion: '1.4.0',
    eventId: over.eventId as string | undefined,
    payload: {
      business_id: businessId,
      invoice_id: uuidv7(),
      customer_id: uuidv7(),
      customer_name: 'Bakari Traders',
      customer_email: 'bakari@buyer.io',
      number: 1,
      currency: 'TZS',
      total_minor: 30000,
      balance_due_minor: 30000,
      issue_date: '2026-09-01T00:00:00.000Z',
      due_date: '2026-09-15T00:00:00.000Z',
      public_token: `tok_${uuidv7()}`,
      locale: 'sw',
      business_name: 'Duka la Asha',
      subtotal_minor: 30000,
      discount_minor: 0,
      tax_minor: 0,
      lines: [
        {
          description: 'Sukari',
          quantity: 12,
          unit_price_minor: 2500,
          discount_minor: 0,
          line_total_minor: 30000,
        },
      ],
      ...over,
    },
  });
}

const notifs = (businessId: string) =>
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
  contacts = app.get(ContactProjectionConsumer);
  issued = app.get(NotifInvoiceIssuedConsumer);
  paid = app.get(NotifInvoicePaymentConsumer);
  voided = app.get(NotifInvoiceVoidedConsumer);
  sweep = app.get(OverdueSweepJob);
});

afterEach(async () => {
  email.reset();
  await prisma.$executeRawUnsafe('DELETE FROM notification');
  await prisma.$executeRawUnsafe('DELETE FROM overdue_invoice');
  await prisma.$executeRawUnsafe('DELETE FROM notification_contact');
  await prisma.$executeRawUnsafe('DELETE FROM notification_business');
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await prisma.$executeRawUnsafe('DELETE FROM processed_events');
});

afterAll(async () => {
  await app.close();
});

describe('notifications — invoice emails', () => {
  it('InvoiceIssued → one localized invoice_issued email + an open-invoice row; a dup event_id does nothing', async () => {
    const businessId = uuidv7();
    await seedBusiness(businessId);
    const evt = issuedEvent({ business_id: businessId, eventId: uuidv7() });

    await issued.onEvent(evt);
    await issued.onEvent(evt); // same event_id

    const rows = await notifs(businessId);
    expect(rows.filter((r) => r.type === 'invoice_issued')).toHaveLength(1);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toEqual(['bakari@buyer.io']);
    expect(email.sent[0].subject).toContain('Ankara #1'); // sw
    expect(email.sent[0].text).toContain('/i/');

    const open = await prisma.overdueInvoice.findMany({
      where: { businessId },
    });
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ balanceDueMinor: 30000, number: 1 });
  });

  it('falls back to English for an unknown locale', async () => {
    const businessId = uuidv7();
    await seedBusiness(businessId, 'owner@shop.io', 'en');
    await issued.onEvent(
      issuedEvent({ business_id: businessId, locale: 'fr' }),
    );
    expect(email.sent[0].subject).toContain('Invoice #1');
  });

  it('no customer_email → no email, but the open-invoice row is still kept', async () => {
    const businessId = uuidv7();
    await seedBusiness(businessId);
    const evt = issuedEvent({ business_id: businessId });
    (evt.payload as Record<string, unknown>).customer_email = undefined;

    await issued.onEvent(evt);
    expect(email.sent).toHaveLength(0);
    expect(await prisma.overdueInvoice.count({ where: { businessId } })).toBe(
      1,
    );
  });

  it('InvoicePaymentRecorded → payment_received email; paid_in_full closes the open-invoice row', async () => {
    const businessId = uuidv7();
    await seedBusiness(businessId);
    const iEvt = issuedEvent({ business_id: businessId });
    const invoiceId = (iEvt.payload as { invoice_id: string }).invoice_id;
    await issued.onEvent(iEvt);
    email.reset();

    await paid.onEvent(
      makeEnvelope({
        producer: 'sales',
        businessId,
        schemaVersion: '1.4.0',
        payload: {
          business_id: businessId,
          invoice_id: invoiceId,
          payment_id: uuidv7(),
          amount_minor: 10000,
          method: 'cash',
          balance_due_minor: 20000,
          paid_in_full: false,
          customer_email: 'bakari@buyer.io',
          locale: 'sw',
        },
      }),
    );
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].text).toContain('20,000');
    expect(
      await prisma.overdueInvoice.findUnique({ where: { invoiceId } }),
    ).toMatchObject({
      balanceDueMinor: 20000,
    });

    email.reset();
    await paid.onEvent(
      makeEnvelope({
        producer: 'sales',
        businessId,
        schemaVersion: '1.4.0',
        payload: {
          business_id: businessId,
          invoice_id: invoiceId,
          payment_id: uuidv7(),
          amount_minor: 20000,
          method: 'cash',
          balance_due_minor: 0,
          paid_in_full: true,
          customer_email: 'bakari@buyer.io',
          locale: 'sw',
        },
      }),
    );
    expect(email.sent[0].subject).toContain('imelipwa yote');
    expect(
      await prisma.overdueInvoice.findUnique({ where: { invoiceId } }),
    ).toBeNull();
  });

  it('InvoiceVoided drops the open-invoice row', async () => {
    const businessId = uuidv7();
    await seedBusiness(businessId);
    const iEvt = issuedEvent({ business_id: businessId });
    const invoiceId = (iEvt.payload as { invoice_id: string }).invoice_id;
    await issued.onEvent(iEvt);
    expect(await prisma.overdueInvoice.count({ where: { businessId } })).toBe(
      1,
    );

    await voided.onEvent(
      makeEnvelope({
        producer: 'sales',
        businessId,
        schemaVersion: '1.4.0',
        payload: {
          business_id: businessId,
          invoice_id: invoiceId,
          reason: 'entered twice',
        },
      }),
    );
    expect(await prisma.overdueInvoice.count({ where: { businessId } })).toBe(
      0,
    );
  });
});

describe('notifications — overdue sweep', () => {
  it('emails the customer + an owner summary for a past-due invoice; a current one is left alone; a re-run inside the interval sends nothing', async () => {
    const businessId = uuidv7();
    await seedBusiness(businessId, 'owner@shop.io', 'sw');

    // one overdue (due 20 days ago), one current (due in 5 days)
    await issued.onEvent(
      issuedEvent({
        business_id: businessId,
        number: 1,
        due_date: new Date(Date.now() - 20 * DAY).toISOString(),
      }),
    );
    await issued.onEvent(
      issuedEvent({
        business_id: businessId,
        number: 2,
        due_date: new Date(Date.now() + 5 * DAY).toISOString(),
      }),
    );
    email.reset();

    const now = new Date();
    const sent1 = await sweep.tick(now);
    expect(sent1).toBe(2); // one customer digest + one owner summary

    const recipients = email.sent.flatMap((m) => m.to).sort();
    expect(recipients).toEqual(['bakari@buyer.io', 'owner@shop.io']);
    const custMail = email.sent.find((m) => m.to.includes('bakari@buyer.io'))!;
    expect(custMail.text).toContain('#1');
    expect(custMail.text).not.toContain('#2'); // the current invoice is excluded

    // re-run the same day → dedupe + interval guard → nothing new
    email.reset();
    const sent2 = await sweep.tick(new Date(now.getTime() + 60_000));
    expect(sent2).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it('skips a customer with no email but still sends the owner summary', async () => {
    const businessId = uuidv7();
    await seedBusiness(businessId, 'owner@shop.io', 'en');
    const evt = issuedEvent({
      business_id: businessId,
      number: 7,
      due_date: new Date(Date.now() - 3 * DAY).toISOString(),
    });
    (evt.payload as Record<string, unknown>).customer_email = undefined;
    await issued.onEvent(evt);
    email.reset();

    const sent = await sweep.tick(new Date());
    expect(sent).toBe(1); // owner only
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toEqual(['owner@shop.io']);
  });
});
