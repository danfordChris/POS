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

const saleVoided = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.SaleVoided,
});

/**
 * Reverses stock when `sales` voids a sale: `StockService.reverseSale` writes
 * one `void_reversal` movement per line and moves on-hand back. Idempotent on
 * `event_id`.
 */
@Injectable()
export class SaleVoidedConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(SaleVoidedConsumer.name);
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

  /** Wire the subscription. Exposed for tests. */
  async register(): Promise<void> {
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.sales.saleVoided,
      (msg) => this.handle(msg.data),
      {
        durable: 'inventory-sale-voided',
        maxDeliver: 5,
        dlqSubject: dlqSubject('sales', 'SaleVoided'),
      },
    );
    this.logger.log('subscribed to sales.SaleVoided');
  }

  async handle(raw: unknown): Promise<void> {
    const evt = saleVoided.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.sales.saleVoided,
      () =>
        this.stock.reverseSale(
          evt.payload.business_id,
          evt.payload.sale_id,
          evt.payload.lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
          })),
        ),
    );
  }
}
