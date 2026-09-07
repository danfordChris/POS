import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { MESSAGE_BUS, OutboxWriter } from '@pos/nest-common';
import {
  SCHEMA_VERSION,
  SUBJECTS,
  makeEnvelope,
  renderInvoiceRequest,
  type MessageBus,
} from '@pos/contracts';
import { DocumentService, RenderResult } from './document.service.js';

const outbox = new OutboxWriter();

/** `pos.rpc.media.renderInvoice` — force a re-render from the stored snapshot.
 * The normal path is the `InvoiceIssued` event; callers tolerate `503`. */
@Injectable()
export class MediaRpc implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaRpc.name);

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly documents: DocumentService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.reply(SUBJECTS.media.renderInvoice, (raw) => this.renderInvoice(raw));
    this.logger.log('RPC handler registered (renderInvoice)');
  }

  async renderInvoice(
    raw: unknown,
  ): Promise<{ found: true; url: string; bytes: number; sha256: string } | { found: false }> {
    const { business_id, invoice_id } = renderInvoiceRequest.parse(raw);
    const snapshot = await this.documents.snapshotFor(business_id, invoice_id);
    if (!snapshot) return { found: false };

    const r: RenderResult = await this.documents.renderAndStore(snapshot, async (tx, res) => {
      await outbox.write(tx, {
        subject: SUBJECTS.media.invoiceDocumentReady,
        payload: makeEnvelope({
          producer: 'media',
          businessId: business_id,
          schemaVersion: SCHEMA_VERSION,
          payload: {
            business_id,
            invoice_id,
            url: res.url,
            bytes: res.bytes,
            sha256: res.sha256,
          },
        }),
      });
    });

    return { found: true, url: r.url, bytes: r.bytes, sha256: r.sha256 };
  }
}
