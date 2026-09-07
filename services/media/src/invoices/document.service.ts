import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';
import { ObjectStore } from './object-store.js';
import { renderInvoicePdf } from './pdf.js';
import type { InvoiceSnapshot } from './invoice-snapshot.js';

export interface RenderResult {
  url: string;
  bytes: number;
  sha256: string;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: ObjectStore,
  ) {}

  private key(businessId: string, invoiceId: string): string {
    return `invoices/${businessId}/${invoiceId}.pdf`;
  }

  /** Has a document already been rendered for this invoice? */
  async exists(businessId: string, invoiceId: string): Promise<boolean> {
    const row = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.document.findUnique({
        where: {
          businessId_kind_refId: {
            businessId,
            kind: 'invoice',
            refId: invoiceId,
          },
        },
        select: { id: true },
      }),
    );
    return row !== null;
  }

  /**
   * Render the invoice PDF, store it (overwriting), upsert the `document` row,
   * and — inside the same tenant transaction — run `onPersist` (used to enqueue
   * `InvoiceDocumentReady` transactionally). Returns the stored object's URL,
   * size and hash.
   */
  async renderAndStore(
    snapshot: InvoiceSnapshot,
    onPersist?: (tx: Prisma.TransactionClient, r: RenderResult) => Promise<void>,
  ): Promise<RenderResult> {
    const pdf = await renderInvoicePdf(snapshot);
    const bytes = pdf.byteLength;
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    const url = await this.store.put(
      this.key(snapshot.business_id, snapshot.invoice_id),
      pdf,
      'application/pdf',
    );
    const result: RenderResult = { url, bytes, sha256 };

    await this.prisma.runInTenantContext(snapshot.business_id, async (tx) => {
      await tx.document.upsert({
        where: {
          businessId_kind_refId: {
            businessId: snapshot.business_id,
            kind: 'invoice',
            refId: snapshot.invoice_id,
          },
        },
        create: {
          businessId: snapshot.business_id,
          kind: 'invoice',
          refId: snapshot.invoice_id,
          publicToken: snapshot.public_token,
          url,
          bytes,
          sha256,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
        update: {
          publicToken: snapshot.public_token,
          url,
          bytes,
          sha256,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
      if (onPersist) await onPersist(tx, result);
    });

    this.logger.log(
      `rendered invoice ${snapshot.invoice_id} (${bytes} bytes) for ${snapshot.business_id}`,
    );
    return result;
  }

  /** The stored snapshot for `renderInvoice` re-renders, or null. */
  async snapshotFor(businessId: string, invoiceId: string): Promise<InvoiceSnapshot | null> {
    const row = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.document.findUnique({
        where: {
          businessId_kind_refId: {
            businessId,
            kind: 'invoice',
            refId: invoiceId,
          },
        },
        select: { snapshot: true },
      }),
    );
    return (row?.snapshot as unknown as InvoiceSnapshot | undefined) ?? null;
  }

  /** Member-scoped: the stored PDF URL for an invoice, or null. */
  async urlByInvoice(businessId: string, invoiceId: string): Promise<string | null> {
    const row = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.document.findUnique({
        where: {
          businessId_kind_refId: {
            businessId,
            kind: 'invoice',
            refId: invoiceId,
          },
        },
        select: { url: true },
      }),
    );
    return row?.url ?? null;
  }

  /** Public: the stored PDF URL for an invoice token (relaxed-read RLS), or null. */
  async urlByToken(token: string): Promise<string | null> {
    const row = await this.prisma.document.findFirst({
      where: { publicToken: token, kind: 'invoice' },
      select: { url: true },
    });
    return row?.url ?? null;
  }
}
