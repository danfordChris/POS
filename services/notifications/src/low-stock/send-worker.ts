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
import type { Notification } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';

const MAX_ATTEMPTS = 3;
const BATCH = 50;
const outbox = new OutboxWriter();

interface LowStockPayload {
  product_id: string;
  on_hand: number;
  threshold: number;
  catalog_url: string;
  recipients: string[];
}

/**
 * Drains `queued` (and retryable `failed`) notifications: renders a placeholder
 * body, sends via `EmailSender`, records `sent` / `failed` and emits
 * `NotificationSent` / `NotificationFailed`. T-0206 swaps the body for localized
 * templates; T-0205 replaces per-row sends with a digest.
 */
@Injectable()
export class SendWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SendWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    const ms = this.config.get<number>('SEND_WORKER_POLL_MS', 5000);
    this.timer = setInterval(() => {
      void this.tick().catch((e) => this.logger.error(e));
    }, ms);
    this.logger.log(`send worker polling every ${ms}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Process one batch. Exposed for tests. Returns rows touched. */
  async tick(): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: {
        type: 'low_stock',
        OR: [
          { status: 'queued' },
          { status: 'failed', attempts: { lt: MAX_ATTEMPTS } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    for (const row of rows) await this.deliver(row);
    return rows.length;
  }

  private async deliver(row: Notification): Promise<void> {
    const payload = row.payload as unknown as LowStockPayload;
    const to = payload.recipients ?? [];

    if (to.length === 0) {
      await this.finish(row, {
        ok: false,
        error: 'no recipients resolved',
        terminal: true,
      });
      return;
    }

    try {
      await this.email.send({
        to,
        subject: `Low stock: product ${payload.product_id}`,
        text:
          `On-hand ${payload.on_hand} is at or below the reorder threshold ` +
          `${payload.threshold}.\n\nOpen the product: ${payload.catalog_url}`,
      });
      await this.finish(row, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.finish(row, {
        ok: false,
        error: message,
        terminal: row.attempts + 1 >= MAX_ATTEMPTS,
      });
    }
  }

  private async finish(
    row: Notification,
    outcome: { ok: true } | { ok: false; error: string; terminal: boolean },
  ): Promise<void> {
    await this.prisma.runInTenantContext(row.businessId, async (tx) => {
      if (outcome.ok) {
        await tx.notification.update({
          where: { id: row.id },
          data: { status: 'sent', sentAt: new Date() },
        });
        await outbox.write(tx, {
          subject: SUBJECTS.notifications.notificationSent,
          payload: makeEnvelope({
            producer: 'notifications',
            businessId: row.businessId,
            schemaVersion: SCHEMA_VERSION,
            payload: {
              business_id: row.businessId,
              notification_id: row.id,
              type: row.type,
              channel: row.channel,
            },
          }),
        });
        return;
      }

      const attempts = outcome.terminal ? MAX_ATTEMPTS : row.attempts + 1;
      await tx.notification.update({
        where: { id: row.id },
        data: { status: 'failed', attempts, lastError: outcome.error },
      });
      if (outcome.terminal) {
        await outbox.write(tx, {
          subject: SUBJECTS.notifications.notificationFailed,
          payload: makeEnvelope({
            producer: 'notifications',
            businessId: row.businessId,
            schemaVersion: SCHEMA_VERSION,
            payload: {
              business_id: row.businessId,
              notification_id: row.id,
              type: row.type,
              channel: row.channel,
              error: outcome.error,
            },
          }),
        });
      }
    });
  }
}
