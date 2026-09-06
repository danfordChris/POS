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
import { PrismaService } from '../../prisma/prisma.service.js';

const upserted = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.ProductUpserted,
});
const priceChanged = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.PriceChanged,
});

/** Keeps `product_cache` in step with the catalog so a sale line can be priced /
 * named without a sync call. Idempotent on `event_id`. */
@Injectable()
export class ProductCacheConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductCacheConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
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
      SUBJECTS.catalog.productUpserted,
      (msg) => this.onUpserted(msg.data),
      {
        durable: 'sales-product-upserted',
        maxDeliver: 5,
        dlqSubject: dlqSubject('catalog', 'ProductUpserted'),
      },
    );
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.catalog.priceChanged,
      (msg) => this.onPriceChanged(msg.data),
      {
        durable: 'sales-price-changed',
        maxDeliver: 5,
        dlqSubject: dlqSubject('catalog', 'PriceChanged'),
      },
    );
    this.logger.log('subscribed to catalog.ProductUpserted / PriceChanged');
  }

  async onUpserted(raw: unknown): Promise<void> {
    const evt = upserted.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.catalog.productUpserted,
      () =>
        this.prisma.runInTenantContext(evt.payload.business_id, (tx) =>
          tx.productCache.upsert({
            where: {
              businessId_productId: {
                businessId: evt.payload.business_id,
                productId: evt.payload.product_id,
              },
            },
            create: {
              businessId: evt.payload.business_id,
              productId: evt.payload.product_id,
              name: evt.payload.name,
            },
            update: { name: evt.payload.name },
          }),
        ),
    );
  }

  async onPriceChanged(raw: unknown): Promise<void> {
    const evt = priceChanged.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.catalog.priceChanged,
      () =>
        this.prisma.runInTenantContext(evt.payload.business_id, (tx) =>
          tx.productCache.upsert({
            where: {
              businessId_productId: {
                businessId: evt.payload.business_id,
                productId: evt.payload.product_id,
              },
            },
            create: {
              businessId: evt.payload.business_id,
              productId: evt.payload.product_id,
              name: '',
              sellPrice: evt.payload.sell_price,
              currency: evt.payload.currency,
            },
            update: {
              sellPrice: evt.payload.sell_price,
              currency: evt.payload.currency,
            },
          }),
        ),
    );
  }
}
