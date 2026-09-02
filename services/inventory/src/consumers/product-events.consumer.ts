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
import { StockService } from '../stock/stock.service.js';

const upsertedEvt = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.ProductUpserted,
});
const deactivatedEvt = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.ProductDeactivated,
});

/**
 * Keeps `stock_item` in step with the catalog: seeds a zero row on the first
 * `ProductUpserted`, tracks `reorder_threshold` + active flag, and flips
 * `product_active` off on `ProductDeactivated`. Idempotent on `event_id`.
 */
@Injectable()
export class ProductEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductEventsConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
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
      SUBJECTS.catalog.productUpserted,
      (msg) => this.onUpserted(msg.data),
      {
        durable: 'inventory-product-upserted',
        maxDeliver: 5,
        dlqSubject: dlqSubject('catalog', 'ProductUpserted'),
      },
    );
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.catalog.productDeactivated,
      (msg) => this.onDeactivated(msg.data),
      {
        durable: 'inventory-product-deactivated',
        maxDeliver: 5,
        dlqSubject: dlqSubject('catalog', 'ProductDeactivated'),
      },
    );
    this.logger.log(
      'subscribed to catalog.ProductUpserted / ProductDeactivated',
    );
  }

  async onUpserted(raw: unknown): Promise<void> {
    const evt = upsertedEvt.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.catalog.productUpserted,
      () =>
        this.stock.applyProductUpserted(evt.payload.business_id, evt.payload),
    );
  }

  async onDeactivated(raw: unknown): Promise<void> {
    const evt = deactivatedEvt.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.catalog.productDeactivated,
      () =>
        this.stock.applyProductDeactivated(
          evt.payload.business_id,
          evt.payload.product_id,
        ),
    );
  }
}
