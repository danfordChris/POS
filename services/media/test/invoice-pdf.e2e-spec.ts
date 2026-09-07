import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { uuidv7 } from 'uuidv7';
import { vi } from 'vitest';
import {
  configureApp,
  registerNotFoundFallback,
  signInternalContext,
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_CONTEXT_SIGNATURE_HEADER,
  MESSAGE_BUS,
} from '@pos/nest-common';
import { SUBJECTS, makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InvoiceIssuedConsumer } from '../src/invoices/invoice-issued.consumer.js';
import { MediaRpc } from '../src/invoices/media.rpc.js';
import { ObjectStore } from '../src/invoices/object-store.js';

let app: INestApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;
let consumer: InvoiceIssuedConsumer;
let rpc: MediaRpc;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const bizA = uuidv7();
const bizB = uuidv7();

const puts = new Map<string, Uint8Array>();
const store = {
  put: vi.fn(async (key: string, body: Uint8Array) => {
    puts.set(key, body);
    return `http://fake-store.local/${key}`;
  }),
};

function ctx(businessId: string, role: 'owner' | 'staff' = 'owner') {
  const { header, signature } = signInternalContext(
    {
      request_id: `t-${uuidv7()}`,
      user_id: uuidv7(),
      business_id: businessId,
      role,
      token_kind: 'user',
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

function issuedEvent(businessId: string, invoiceId: string, token: string, eventId?: string) {
  return makeEnvelope({
    producer: 'sales',
    businessId,
    schemaVersion: '1.4.0',
    eventId,
    payload: {
      business_id: businessId,
      invoice_id: invoiceId,
      customer_id: uuidv7(),
      customer_name: 'Asha Traders',
      customer_email: 'asha@t.io',
      number: 1,
      currency: 'TZS',
      total_minor: 10000,
      balance_due_minor: 10000,
      issue_date: '2026-09-07T00:00:00.000Z',
      due_date: '2026-09-21T00:00:00.000Z',
      public_token: token,
      locale: 'sw',
      business_name: 'Duka la Asha',
      subtotal_minor: 10000,
      discount_minor: 0,
      tax_minor: 0,
      lines: [
        {
          description: 'Sukari 1kg',
          quantity: 4,
          unit_price_minor: 2500,
          discount_minor: 0,
          line_total_minor: 10000,
        },
      ],
    },
  });
}

const docReady = (biz: string) =>
  prisma.outboxMessage
    .findMany({ where: { subject: SUBJECTS.media.invoiceDocumentReady } })
    .then((rs) =>
      rs
        .map((r) => (r.payload as { payload: Record<string, unknown> }).payload)
        .filter((p) => p.business_id === biz),
    );

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .overrideProvider(ObjectStore)
    .useValue(store)
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);

  prisma = app.get(PrismaService);
  consumer = app.get(InvoiceIssuedConsumer);
  rpc = app.get(MediaRpc);
  http = request(app.getHttpServer());
});

afterAll(async () => {
  for (const b of [bizA, bizB]) {
    await prisma.runInTenantContext(b, (tx) => tx.document.deleteMany({}));
  }
  await prisma.$executeRawUnsafe('DELETE FROM outbox');
  await prisma.$executeRawUnsafe('DELETE FROM processed_events');
  await app.close();
});

describe('media — invoice PDF', () => {
  it('renders + stores a PDF for InvoiceIssued and emits one InvoiceDocumentReady', async () => {
    const invoiceId = uuidv7();
    const token = `tok_${uuidv7()}`;
    await consumer.onInvoiceIssued(issuedEvent(bizA, invoiceId, token));

    const key = `invoices/${bizA}/${invoiceId}.pdf`;
    expect(puts.has(key)).toBe(true);
    const buf = puts.get(key)!;
    expect(buf.byteLength).toBeGreaterThan(500);
    // PDF magic bytes
    expect(Buffer.from(buf.slice(0, 5)).toString('latin1')).toBe('%PDF-');

    const row = await prisma.runInTenantContext(bizA, (tx) =>
      tx.document.findUnique({
        where: { businessId_kind_refId: { businessId: bizA, kind: 'invoice', refId: invoiceId } },
      }),
    );
    expect(row).toMatchObject({ publicToken: token, url: `http://fake-store.local/${key}` });
    expect(row!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.bytes).toBe(buf.byteLength);

    const ready = await docReady(bizA);
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({ invoice_id: invoiceId, url: row!.url, sha256: row!.sha256 });
  });

  it('is idempotent on event_id and dedupes on invoice_id', async () => {
    const invoiceId = uuidv7();
    const token = `tok_${uuidv7()}`;
    const eventId = uuidv7();
    store.put.mockClear();

    await consumer.onInvoiceIssued(issuedEvent(bizA, invoiceId, token, eventId));
    await consumer.onInvoiceIssued(issuedEvent(bizA, invoiceId, token, eventId)); // same event_id
    await consumer.onInvoiceIssued(issuedEvent(bizA, invoiceId, token)); // new event_id, same invoice

    expect(store.put).toHaveBeenCalledTimes(1);
    const ready = (await docReady(bizA)).filter((p) => p.invoice_id === invoiceId);
    expect(ready).toHaveLength(1);
  });

  it('GET /v1/businesses/{id}/invoices/{id}/pdf: 202 before, 302 after', async () => {
    const invoiceId = uuidv7();
    const token = `tok_${uuidv7()}`;

    const pending = await http
      .get(`/v1/businesses/${bizA}/invoices/${invoiceId}/pdf`)
      .set(ctx(bizA));
    expect(pending.status).toBe(202);
    expect(pending.headers['retry-after']).toBe('2');

    await consumer.onInvoiceIssued(issuedEvent(bizA, invoiceId, token));

    const ready = await http
      .get(`/v1/businesses/${bizA}/invoices/${invoiceId}/pdf`)
      .set(ctx(bizA))
      .redirects(0);
    expect(ready.status).toBe(302);
    expect(ready.headers.location).toBe(
      `http://fake-store.local/invoices/${bizA}/${invoiceId}.pdf`,
    );

    // operator / wrong-business are rejected by TenantGuard
    const op = await http.get(`/v1/businesses/${bizA}/invoices/${invoiceId}/pdf`).set(ctx(bizB));
    expect(op.status).toBe(403);
  });

  it('GET /v1/i/{token}/pdf: public, no auth, 202 → 302', async () => {
    const invoiceId = uuidv7();
    const token = `tok_${uuidv7()}`;

    const pending = await http.get(`/v1/i/${token}/pdf`);
    expect(pending.status).toBe(202);

    await consumer.onInvoiceIssued(issuedEvent(bizB, invoiceId, token));

    const ready = await http.get(`/v1/i/${token}/pdf`).redirects(0);
    expect(ready.status).toBe(302);
    expect(ready.headers.location).toBe(
      `http://fake-store.local/invoices/${bizB}/${invoiceId}.pdf`,
    );

    const unknown = await http.get(`/v1/i/tok_${uuidv7()}/pdf`);
    expect(unknown.status).toBe(202);
  });

  it('renderInvoice RPC re-renders from the stored snapshot; unknown → not found', async () => {
    const invoiceId = uuidv7();
    const token = `tok_${uuidv7()}`;
    await consumer.onInvoiceIssued(issuedEvent(bizA, invoiceId, token));
    store.put.mockClear();

    const hit = await rpc.renderInvoice({ business_id: bizA, invoice_id: invoiceId });
    expect(hit).toMatchObject({
      found: true,
      url: `http://fake-store.local/invoices/${bizA}/${invoiceId}.pdf`,
    });
    expect(store.put).toHaveBeenCalledTimes(1); // re-rendered

    const miss = await rpc.renderInvoice({ business_id: bizA, invoice_id: uuidv7() });
    expect(miss).toEqual({ found: false });
  });

  it('document is business-scoped for writes but relaxed-read by token', async () => {
    const invoiceId = uuidv7();
    const token = `tok_${uuidv7()}`;
    await consumer.onInvoiceIssued(issuedEvent(bizA, invoiceId, token));

    // no tenant context: a foreign-scoped lookup sees nothing…
    const foreign = await prisma.runInTenantContext(bizB, (tx) =>
      tx.document.findMany({ where: { businessId: bizA } }),
    );
    expect(foreign).toHaveLength(0);

    // …but the by-token relaxed read (unscoped) resolves
    const byToken = await prisma.document.findFirst({ where: { publicToken: token } });
    expect(byToken?.businessId).toBe(bizA);
  });
});
