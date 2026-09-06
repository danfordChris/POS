import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  MESSAGE_BUS,
  PrismaIdempotencyStore,
  runIdempotent,
  subscribeWithDlq,
} from '@pos/nest-common';
import {
  EVENT_PAYLOADS,
  SUBJECTS,
  dlqSubject,
  messageEnvelopeSchema,
  type MessageBus,
} from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationService } from './notification.service.js';

const fellBelow = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.StockFellBelowThreshold,
});
const recovered = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.StockRecovered,
});

/**
 * Turns inventory's low-stock edge events into `queued` `low_stock`
 * notifications. Idempotent on `event_id`; also deduped on the window
 * `dedupe_key` so a redelivered edge for the same window is a no-op.
 */
@Injectable()
export class LowStockConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(LowStockConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {
    this.idempotency = new PrismaIdempotencyStore(this.prisma);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.register();
  }

  /** Wire the subscriptions. Exposed for tests. */
  async register(): Promise<void> {
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.inventory.stockFellBelowThreshold,
      (msg) => this.onFellBelow(msg.data),
      {
        durable: 'notifications-stock-fell-below',
        maxDeliver: 5,
        dlqSubject: dlqSubject('inventory', 'StockFellBelowThreshold'),
      },
    );
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.inventory.stockRecovered,
      (msg) => this.onRecovered(msg.data),
      {
        durable: 'notifications-stock-recovered',
        maxDeliver: 5,
        dlqSubject: dlqSubject('inventory', 'StockRecovered'),
      },
    );
    this.logger.log(
      'subscribed to inventory.StockFellBelowThreshold / StockRecovered',
    );
  }

  async onFellBelow(raw: unknown): Promise<void> {
    const evt = fellBelow.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.inventory.stockFellBelowThreshold,
      () => this.notifications.recordLowStock(evt.payload),
    );
  }

  async onRecovered(raw: unknown): Promise<void> {
    const evt = recovered.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.inventory.stockRecovered,
      () => this.notifications.closeLowStock(evt.payload),
    );
  }
}
