import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '#prisma';
import { PrismaService } from '../prisma/prisma.service.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FellBelow {
  business_id: string;
  product_id: string;
  on_hand: number;
  threshold: number;
  opened_at: string;
  recipients: string[];
}

export interface Recovered {
  business_id: string;
  product_id: string;
  opened_at: string;
}

export const lowStockDedupeKey = (e: {
  business_id: string;
  product_id: string;
  opened_at: string;
}): string => `low_stock:${e.business_id}:${e.product_id}:${e.opened_at}`;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Create the `queued` low_stock notification for this window (idempotent on
   * `dedupe_key`). Returns false when the window already has one. */
  async recordLowStock(e: FellBelow): Promise<boolean> {
    const dedupeKey = lowStockDedupeKey(e);
    const catalogUrl = `${this.config.getOrThrow<string>('WEB_BASE_URL')}/catalog/${e.product_id}`;

    return this.prisma.runInTenantContext(e.business_id, async (tx) => {
      const recipients = await this.resolveRecipients(
        tx,
        e.business_id,
        e.recipients,
      );
      try {
        await tx.notification.create({
          data: {
            businessId: e.business_id,
            type: 'low_stock',
            channel: 'email',
            status: 'queued',
            dedupeKey,
            payload: {
              product_id: e.product_id,
              on_hand: e.on_hand,
              threshold: e.threshold,
              opened_at: e.opened_at,
              recipients,
              catalog_url: catalogUrl,
            },
          },
        });
        return true;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return false; // same window already recorded
        }
        throw error;
      }
    });
  }

  /** Supersede a still-queued low_stock notification when its product recovers. */
  async closeLowStock(e: Recovered): Promise<void> {
    const dedupeKey = lowStockDedupeKey(e);
    await this.prisma.runInTenantContext(e.business_id, (tx) =>
      tx.notification.updateMany({
        where: { dedupeKey, status: 'queued' },
        data: { status: 'superseded' },
      }),
    );
  }

  /** Event `recipients` when non-empty (emails as-is, uuids via the contact
   * projection); otherwise the business's active-owner emails. */
  private async resolveRecipients(
    tx: Prisma.TransactionClient,
    businessId: string,
    fromEvent: string[],
  ): Promise<string[]> {
    if (fromEvent.length > 0) {
      const emails = fromEvent.filter((r) => EMAIL_RE.test(r));
      const ids = fromEvent.filter((r) => UUID_RE.test(r));
      if (ids.length > 0) {
        const rows = await tx.notificationContact.findMany({
          where: { userId: { in: ids }, active: true, email: { not: null } },
        });
        for (const r of rows) if (r.email) emails.push(r.email);
      }
      const unique = [...new Set(emails)];
      if (unique.length > 0) return unique;
      this.logger.warn(
        `alert_config.recipients for ${businessId} resolved to no email; falling back to owners`,
      );
    }
    const owners = await tx.notificationContact.findMany({
      where: { role: 'owner', active: true, email: { not: null } },
    });
    return [...new Set(owners.map((o) => o.email!).filter(Boolean))];
  }
}
