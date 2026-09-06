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

const MAX_ATTEMPTS = 3;
const outbox = new OutboxWriter();

interface LowStockPayload {
  product_id: string;
  on_hand: number;
  threshold: number;
  catalog_url: string;
  recipients: string[];
}
type ClaimedRow = { id: string; payload: LowStockPayload; attempts: number };

/**
 * One digest email per business per window. The window opens with the oldest
 * `queued` low_stock notification and is due after that business's
 * `digest_config.min_interval_hours`. A per-business claim (`queued → sending`
 * inside a tenant transaction) makes concurrent flushes safe.
 */
@Injectable()
export class DigestFlushJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DigestFlushJob.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    const ms = this.config.get<number>('DIGEST_POLL_MS', 60_000);
    this.timer = setInterval(() => {
      void this.tick().catch((e) => this.logger.error(e));
    }, ms);
    this.logger.log(`digest flush polling every ${ms}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Flush every due business. Returns the count of digests sent. Exposed for tests. */
  async tick(now: Date = new Date()): Promise<number> {
    const groups = await this.prisma.$queryRaw<
      { business_id: string; opened_at: Date }[]
    >`
      SELECT business_id, min(created_at) AS opened_at
      FROM notification
      WHERE type = 'low_stock' AND status = 'queued'
      GROUP BY business_id`;
    if (groups.length === 0) return 0;

    const defaultHours = this.config.get<number>(
      'DIGEST_DEFAULT_INTERVAL_HOURS',
      24,
    );
    const configs = await this.prisma.digestConfig.findMany({
      where: { businessId: { in: groups.map((g) => g.business_id) } },
    });
    const intervalFor = new Map(
      configs.map((c) => [c.businessId, c.minIntervalHours]),
    );

    let sent = 0;
    for (const g of groups) {
      const hours = intervalFor.get(g.business_id) ?? defaultHours;
      const dueAt = g.opened_at.getTime() + hours * 3_600_000;
      if (now.getTime() < dueAt) continue;
      if (await this.flushBusiness(g.business_id)) sent += 1;
    }
    return sent;
  }

  private async flushBusiness(businessId: string): Promise<boolean> {
    const claimed = await this.prisma.runInTenantContext(
      businessId,
      async (tx) => {
        const { count } = await tx.notification.updateMany({
          where: { type: 'low_stock', status: 'queued' },
          data: { status: 'sending' },
        });
        if (count === 0) return [];
        const rows = await tx.notification.findMany({
          where: { type: 'low_stock', status: 'sending' },
        });
        return rows.map((r) => ({
          id: r.id,
          payload: r.payload as unknown as LowStockPayload,
          attempts: r.attempts,
        })) as ClaimedRow[];
      },
    );
    if (claimed.length === 0) return false;

    const recipients = [
      ...new Set(claimed.flatMap((c) => c.payload.recipients ?? [])),
    ];
    if (recipients.length === 0) {
      await this.settle(businessId, claimed, {
        ok: false,
        error: 'no recipients resolved',
        terminalAll: true,
      });
      return false;
    }

    try {
      await this.email.send({
        to: recipients,
        subject: `Low stock: ${claimed.length} product${claimed.length === 1 ? '' : 's'}`,
        text: [
          `${claimed.length} product(s) are at or below their reorder threshold:`,
          ...claimed.map(
            (c) =>
              `- ${c.payload.product_id}: on-hand ${c.payload.on_hand} (threshold ${c.payload.threshold}) — ${c.payload.catalog_url}`,
          ),
        ].join('\n'),
      });
      await this.settle(businessId, claimed, { ok: true });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.settle(businessId, claimed, { ok: false, error: message });
      return false;
    }
  }

  private async settle(
    businessId: string,
    rows: ClaimedRow[],
    outcome: { ok: true } | { ok: false; error: string; terminalAll?: boolean },
  ): Promise<void> {
    await this.prisma.runInTenantContext(businessId, async (tx) => {
      for (const row of rows) {
        if (outcome.ok) {
          await tx.notification.update({
            where: { id: row.id },
            data: { status: 'sent', sentAt: new Date() },
          });
          await this.emit(
            tx,
            businessId,
            row.id,
            SUBJECTS.notifications.notificationSent,
          );
          continue;
        }
        const attempts = outcome.terminalAll ? MAX_ATTEMPTS : row.attempts + 1;
        const terminal = attempts >= MAX_ATTEMPTS;
        await tx.notification.update({
          where: { id: row.id },
          data: {
            status: terminal ? 'failed' : 'queued',
            attempts,
            lastError: outcome.error,
          },
        });
        if (terminal) {
          await this.emit(
            tx,
            businessId,
            row.id,
            SUBJECTS.notifications.notificationFailed,
            outcome.error,
          );
        }
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
          type: 'low_stock',
          channel: 'email',
          ...(error ? { error } : {}),
        },
      }),
    });
  }
}
