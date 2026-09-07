import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { Prisma } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { TemplateRegistry } from '../templates/template-registry.js';

const outbox = new OutboxWriter();

export interface InvoiceIssuedEvent {
  business_id: string;
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  number: number;
  currency: string;
  total_minor: number;
  balance_due_minor: number;
  issue_date: string;
  due_date: string;
  public_token: string;
  locale: string;
}

export interface InvoicePaymentEvent {
  business_id: string;
  invoice_id: string;
  payment_id: string;
  amount_minor: number;
  method: string;
  balance_due_minor: number;
  paid_in_full: boolean;
  customer_email?: string;
  locale: string;
}

export interface InvoiceVoidedEvent {
  business_id: string;
  invoice_id: string;
  reason?: string;
}

const day = (iso: string): string => iso.slice(0, 10);

@Injectable()
export class InvoiceEmailService {
  private readonly logger = new Logger(InvoiceEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly templates: TemplateRegistry,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  private webBase(): string {
    return this.config.getOrThrow<string>('WEB_BASE_URL').replace(/\/+$/, '');
  }

  async recordIssued(e: InvoiceIssuedEvent): Promise<void> {
    await this.prisma.runInTenantContext(e.business_id, async (tx) => {
      await tx.overdueInvoice.upsert({
        where: { invoiceId: e.invoice_id },
        create: {
          invoiceId: e.invoice_id,
          businessId: e.business_id,
          customerId: e.customer_id,
          customerEmail: e.customer_email ?? null,
          number: e.number,
          currency: e.currency,
          balanceDueMinor: e.balance_due_minor,
          dueDate: new Date(e.due_date),
          locale: e.locale,
        },
        update: {
          customerEmail: e.customer_email ?? null,
          balanceDueMinor: e.balance_due_minor,
          dueDate: new Date(e.due_date),
        },
      });

      if (!e.customer_email) return; // projection kept; no customer to email

      const rendered = this.templates.renderInvoiceIssued(e.locale, {
        business_name: await this.businessName(tx, e.business_id),
        customer_name: e.customer_name,
        number: e.number,
        currency: e.currency,
        total_minor: e.total_minor,
        balance_due_minor: e.balance_due_minor,
        due_date: day(e.due_date),
        invoice_url: `${this.webBase()}/i/${e.public_token}`,
      });
      await this.deliver(tx, e.business_id, 'invoice_issued', {
        dedupeKey: `invoice_issued:${e.invoice_id}`,
        to: [e.customer_email],
        rendered,
        payload: { invoice_id: e.invoice_id, number: e.number },
      });
    });
  }

  async recordPayment(e: InvoicePaymentEvent): Promise<void> {
    await this.prisma.runInTenantContext(e.business_id, async (tx) => {
      const proj = await tx.overdueInvoice.findUnique({
        where: { invoiceId: e.invoice_id },
        select: { number: true, currency: true },
      });

      if (e.paid_in_full) {
        await tx.overdueInvoice
          .delete({ where: { invoiceId: e.invoice_id } })
          .catch(() => undefined);
      } else {
        await tx.overdueInvoice
          .update({
            where: { invoiceId: e.invoice_id },
            data: { balanceDueMinor: e.balance_due_minor },
          })
          .catch(() => undefined);
      }

      if (!e.customer_email) return;

      const rendered = this.templates.renderPaymentReceived(e.locale, {
        business_name: await this.businessName(tx, e.business_id),
        number: proj?.number ?? 0,
        currency: proj?.currency ?? '',
        amount_minor: e.amount_minor,
        balance_due_minor: e.balance_due_minor,
        paid_in_full: e.paid_in_full,
      });
      await this.deliver(tx, e.business_id, 'payment_received', {
        dedupeKey: `payment_received:${e.payment_id}`,
        to: [e.customer_email],
        rendered,
        payload: { invoice_id: e.invoice_id, payment_id: e.payment_id },
      });
    });
  }

  async onVoided(e: InvoiceVoidedEvent): Promise<void> {
    await this.prisma.runInTenantContext(e.business_id, async (tx) => {
      await tx.overdueInvoice
        .delete({ where: { invoiceId: e.invoice_id } })
        .catch(() => undefined);
    });
  }

  private async businessName(
    tx: Prisma.TransactionClient,
    businessId: string,
  ): Promise<string> {
    const biz = await tx.notificationBusiness.findUnique({
      where: { businessId },
    });
    return biz?.name ?? 'Your shop';
  }

  /** Create the `notification` row, send, and settle it — mirrors the
   * invitation email path. Dedupe on `dedupeKey` (P2002 → already handled). */
  private async deliver(
    tx: Prisma.TransactionClient,
    businessId: string,
    type: 'invoice_issued' | 'payment_received',
    opts: {
      dedupeKey: string;
      to: string[];
      rendered: { subject: string; text: string; html: string };
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    let notificationId: string;
    try {
      const row = await tx.notification.create({
        data: {
          businessId,
          type,
          channel: 'email',
          status: 'queued',
          dedupeKey: opts.dedupeKey,
          payload: opts.payload as Prisma.InputJsonValue,
        },
      });
      notificationId = row.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }

    try {
      await this.email.send({
        to: opts.to,
        subject: opts.rendered.subject,
        text: opts.rendered.text,
        html: opts.rendered.html,
      });
      await tx.notification.update({
        where: { id: notificationId },
        data: { status: 'sent', sentAt: new Date() },
      });
      await this.emit(
        tx,
        businessId,
        notificationId,
        type,
        SUBJECTS.notifications.notificationSent,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await tx.notification.update({
        where: { id: notificationId },
        data: { status: 'failed', attempts: 1, lastError: message },
      });
      await this.emit(
        tx,
        businessId,
        notificationId,
        type,
        SUBJECTS.notifications.notificationFailed,
        message,
      );
    }
  }

  private emit(
    tx: Prisma.TransactionClient,
    businessId: string,
    notificationId: string,
    type: string,
    subject: string,
    error?: string,
  ): Promise<void> {
    return outbox.write(tx, {
      subject,
      payload: makeEnvelope({
        producer: 'notifications',
        businessId,
        schemaVersion: SCHEMA_VERSION,
        payload: {
          business_id: businessId,
          notification_id: notificationId,
          type,
          channel: 'email',
          ...(error ? { error } : {}),
        },
      }),
    });
  }
}
