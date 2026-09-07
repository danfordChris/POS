import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import type { Prisma } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { TemplateRegistry } from '../templates/template-registry.js';
import type {
  InvoiceOverdueVars,
  OverdueInvoiceLine,
} from '../templates/invoice-vars.js';

const DAY_MS = 86_400_000;
const outbox = new OutboxWriter();

type OverdueRow = {
  invoiceId: string;
  businessId: string;
  customerId: string;
  customerEmail: string | null;
  number: number;
  currency: string;
  balanceDueMinor: number;
  dueDate: Date;
  locale: string;
};

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

/**
 * Daily-ish sweep over `overdue_invoice`. For each business whose last
 * `invoice_overdue` notification is older than its `digest_config`
 * `min_interval_hours`, it emails each customer with past-due invoices and one
 * summary to the business owners.
 */
@Injectable()
export class OverdueSweepJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OverdueSweepJob.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly templates: TemplateRegistry,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    const ms = this.config.get<number>('OVERDUE_POLL_MS', 3_600_000);
    this.timer = setInterval(() => {
      void this.tick().catch((e) => this.logger.error(e));
    }, ms);
    this.logger.log(`overdue sweep polling every ${ms}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Sweep every due business. Returns the number of emails sent. For tests. */
  async tick(now: Date = new Date()): Promise<number> {
    const overdue = (await this.prisma.overdueInvoice.findMany({
      where: { dueDate: { lt: now }, balanceDueMinor: { gt: 0 } },
    })) as OverdueRow[];
    if (overdue.length === 0) return 0;

    const byBusiness = groupBy(overdue, (r) => r.businessId);

    const defaultHours = this.config.get<number>(
      'OVERDUE_DEFAULT_INTERVAL_HOURS',
      24,
    );
    const configs = await this.prisma.digestConfig.findMany({
      where: { businessId: { in: [...byBusiness.keys()] } },
    });
    const intervalFor = new Map(
      configs.map((c) => [c.businessId, c.minIntervalHours]),
    );

    let sent = 0;
    for (const [businessId, rows] of byBusiness) {
      const hours = intervalFor.get(businessId) ?? defaultHours;
      if (await this.recentlySwept(businessId, now, hours)) continue;
      sent += await this.sweepBusiness(businessId, rows, now);
    }
    return sent;
  }

  private async recentlySwept(
    businessId: string,
    now: Date,
    hours: number,
  ): Promise<boolean> {
    const last = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.notification.findFirst({
        where: { type: 'invoice_overdue' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    );
    if (!last) return false;
    return now.getTime() - last.createdAt.getTime() < hours * 3_600_000;
  }

  private async sweepBusiness(
    businessId: string,
    rows: OverdueRow[],
    now: Date,
  ): Promise<number> {
    const biz = await this.prisma.notificationBusiness.findUnique({
      where: { businessId },
    });
    const bizName = biz?.name ?? 'Your shop';
    const bizLocale = biz?.locale ?? 'en';
    const dayKey = now.toISOString().slice(0, 10);

    const toLine = (r: OverdueRow): OverdueInvoiceLine => ({
      number: r.number,
      currency: r.currency,
      balance_due_minor: r.balanceDueMinor,
      due_date: r.dueDate.toISOString().slice(0, 10),
      days_overdue: Math.max(
        1,
        Math.floor((now.getTime() - r.dueDate.getTime()) / DAY_MS),
      ),
    });

    let count = 0;

    // Per-customer digests.
    const byCustomer = groupBy(rows, (r) => r.customerId);
    for (const [customerId, custRows] of byCustomer) {
      const emailAddr = custRows.find((r) => r.customerEmail)?.customerEmail;
      if (!emailAddr) continue; // no customer to email — skipped, not errored
      const lines = custRows.map(toLine);
      const vars: InvoiceOverdueVars = {
        business_name: bizName,
        audience: 'customer',
        invoices: lines,
        total_outstanding_minor: lines.reduce(
          (a, l) => a + l.balance_due_minor,
          0,
        ),
      };
      const rendered = this.templates.renderInvoiceOverdue(
        custRows[0].locale || bizLocale,
        vars,
      );
      if (
        await this.deliver(businessId, {
          dedupeKey: `invoice_overdue:${businessId}:${customerId}:${dayKey}`,
          to: [emailAddr],
          rendered,
          payload: {
            audience: 'customer',
            customer_id: customerId,
            count: lines.length,
          },
        })
      ) {
        count += 1;
      }
    }

    // Owner summary.
    const ownerEmails = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.notificationContact
        .findMany({ where: { role: 'owner', active: true } })
        .then((cs) => cs.map((c) => c.email).filter((e): e is string => !!e)),
    );
    if (ownerEmails.length > 0) {
      const lines = rows.map(toLine);
      const vars: InvoiceOverdueVars = {
        business_name: bizName,
        audience: 'owner',
        invoices: lines,
        total_outstanding_minor: lines.reduce(
          (a, l) => a + l.balance_due_minor,
          0,
        ),
      };
      const rendered = this.templates.renderInvoiceOverdue(bizLocale, vars);
      if (
        await this.deliver(businessId, {
          dedupeKey: `invoice_overdue:${businessId}:owner:${dayKey}`,
          to: ownerEmails,
          rendered,
          payload: { audience: 'owner', count: lines.length },
        })
      ) {
        count += 1;
      }
    }

    return count;
  }

  private async deliver(
    businessId: string,
    opts: {
      dedupeKey: string;
      to: string[];
      rendered: { subject: string; text: string; html: string };
      payload: Record<string, unknown>;
    },
  ): Promise<boolean> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      let id: string;
      try {
        const row = await tx.notification.create({
          data: {
            businessId,
            type: 'invoice_overdue',
            channel: 'email',
            status: 'queued',
            dedupeKey: opts.dedupeKey,
            payload: opts.payload as Prisma.InputJsonValue,
          },
        });
        id = row.id;
      } catch {
        return false; // already sent this window (P2002 on dedupe_key)
      }

      try {
        await this.email.send({
          to: opts.to,
          subject: opts.rendered.subject,
          text: opts.rendered.text,
          html: opts.rendered.html,
        });
        await tx.notification.update({
          where: { id },
          data: { status: 'sent', sentAt: new Date() },
        });
        await this.emit(
          tx,
          businessId,
          id,
          SUBJECTS.notifications.notificationSent,
        );
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await tx.notification.update({
          where: { id },
          data: { status: 'failed', attempts: 1, lastError: message },
        });
        await this.emit(
          tx,
          businessId,
          id,
          SUBJECTS.notifications.notificationFailed,
          message,
        );
        return false;
      }
    });
  }

  private emit(
    tx: Prisma.TransactionClient,
    businessId: string,
    notificationId: string,
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
          type: 'invoice_overdue',
          channel: 'email',
          ...(error ? { error } : {}),
        },
      }),
    });
  }
}
