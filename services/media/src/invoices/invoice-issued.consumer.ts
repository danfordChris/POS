import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  MESSAGE_BUS,
  OutboxWriter,
  PrismaIdempotencyStore,
  runIdempotent,
  subscribeWithDlq,
} from '@pos/nest-common';
import {
  SCHEMA_VERSION,
  SUBJECTS,
  dlqSubject,
  makeEnvelope,
  messageEnvelopeSchema,
  type MessageBus,
} from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { DocumentService } from './document.service.js';
import { invoiceSnapshotSchema } from './invoice-snapshot.js';

const invoiceIssued = messageEnvelopeSchema.extend({
  payload: invoiceSnapshotSchema,
});

const outbox = new OutboxWriter();

/** Renders a PDF for every `sales.InvoiceIssued` and emits `InvoiceDocumentReady`. */
@Injectable()
export class InvoiceIssuedConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(InvoiceIssuedConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly documents: DocumentService,
  ) {
    this.idempotency = new PrismaIdempotencyStore(this.prisma);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.register();
  }

  async register(): Promise<void> {
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.sales.invoiceIssued,
      (msg) => this.onInvoiceIssued(msg.data),
      {
        durable: 'media-invoice-issued',
        maxDeliver: 5,
        dlqSubject: dlqSubject('sales', 'InvoiceIssued'),
      },
    );
    this.logger.log('subscribed to sales.InvoiceIssued');
  }

  async onInvoiceIssued(raw: unknown): Promise<void> {
    const evt = invoiceIssued.parse(raw);
    await runIdempotent(this.idempotency, evt.event_id, SUBJECTS.sales.invoiceIssued, async () => {
      const snap = evt.payload;
      // Dedupe on the invoice: a document already rendered is a no-op.
      if (await this.documents.exists(snap.business_id, snap.invoice_id)) {
        return;
      }
      await this.documents.renderAndStore(snap, async (tx, r) => {
        await outbox.write(tx, {
          subject: SUBJECTS.media.invoiceDocumentReady,
          payload: makeEnvelope({
            producer: 'media',
            businessId: snap.business_id,
            schemaVersion: SCHEMA_VERSION,
            payload: {
              business_id: snap.business_id,
              invoice_id: snap.invoice_id,
              url: r.url,
              bytes: r.bytes,
              sha256: r.sha256,
            },
          }),
        });
      });
    });
  }
}
