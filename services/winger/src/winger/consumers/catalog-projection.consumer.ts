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
const deactivated = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.ProductDeactivated,
});
const stockLevel = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.StockLevelChanged,
});

/**
 * Rebuilds `winger_catalog_projection` from catalog + inventory events so the
 * winger catalog read needs no sync call. Every handler is idempotent on
 * `event_id`; each subscription has its own DLQ.
 */
@Injectable()
export class CatalogProjectionConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogProjectionConsumer.name);
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
        durable: 'winger-product-upserted',
        maxDeliver: 5,
        dlqSubject: dlqSubject('catalog', 'ProductUpserted'),
      },
    );
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.catalog.priceChanged,
      (msg) => this.onPriceChanged(msg.data),
      {
        durable: 'winger-price-changed',
        maxDeliver: 5,
        dlqSubject: dlqSubject('catalog', 'PriceChanged'),
      },
    );
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.catalog.productDeactivated,
      (msg) => this.onDeactivated(msg.data),
      {
        durable: 'winger-product-deactivated',
        maxDeliver: 5,
        dlqSubject: dlqSubject('catalog', 'ProductDeactivated'),
      },
    );
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.inventory.stockLevelChanged,
      (msg) => this.onStockLevel(msg.data),
      {
        durable: 'winger-stock-level-changed',
        maxDeliver: 5,
        dlqSubject: dlqSubject('inventory', 'StockLevelChanged'),
      },
    );
    this.logger.log(
      'subscribed to catalog.ProductUpserted / PriceChanged / ProductDeactivated, inventory.StockLevelChanged',
    );
  }

  async onUpserted(raw: unknown): Promise<void> {
    const evt = upserted.parse(raw);
    const { business_id, product_id, name, is_active } = evt.payload;
    const imageUrl = evt.payload.image_url ?? null;
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.catalog.productUpserted,
      () =>
        this.prisma.runInTenantContext(business_id, (tx) =>
          tx.wingerCatalogProjection.upsert({
            where: {
              businessId_productId: {
                businessId: business_id,
                productId: product_id,
              },
            },
            create: {
              businessId: business_id,
              productId: product_id,
              name,
              imageUrl,
              isActive: is_active,
            },
            update: { name, imageUrl, isActive: is_active },
          }),
        ),
    );
  }

  async onPriceChanged(raw: unknown): Promise<void> {
    const evt = priceChanged.parse(raw);
    const { business_id, product_id, sell_price, winger_price, currency } =
      evt.payload;
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.catalog.priceChanged,
      () =>
        this.prisma.runInTenantContext(business_id, (tx) =>
          tx.wingerCatalogProjection.upsert({
            where: {
              businessId_productId: {
                businessId: business_id,
                productId: product_id,
              },
            },
            create: {
              businessId: business_id,
              productId: product_id,
              name: '',
              sellPrice: sell_price,
              wingerPrice: winger_price,
              currency,
            },
            update: {
              sellPrice: sell_price,
              wingerPrice: winger_price,
              currency,
            },
          }),
        ),
    );
  }

  async onDeactivated(raw: unknown): Promise<void> {
    const evt = deactivated.parse(raw);
    const { business_id, product_id } = evt.payload;
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.catalog.productDeactivated,
      () =>
        this.prisma.runInTenantContext(business_id, (tx) =>
          tx.wingerCatalogProjection.updateMany({
            where: { businessId: business_id, productId: product_id },
            data: { isActive: false },
          }),
        ),
    );
  }

  async onStockLevel(raw: unknown): Promise<void> {
    const evt = stockLevel.parse(raw);
    const { business_id, product_id, on_hand } = evt.payload;
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.inventory.stockLevelChanged,
      () =>
        this.prisma.runInTenantContext(business_id, (tx) =>
          tx.wingerCatalogProjection.upsert({
            where: {
              businessId_productId: {
                businessId: business_id,
                productId: product_id,
              },
            },
            create: {
              businessId: business_id,
              productId: product_id,
              name: '',
              onHand: on_hand,
            },
            update: { onHand: on_hand },
          }),
        ),
    );
  }
}
