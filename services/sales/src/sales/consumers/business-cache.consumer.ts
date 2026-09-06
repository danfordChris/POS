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

const businessCreated = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.BusinessCreated,
});

/** Projects `tenancy.BusinessCreated` into `sales_business` so a receipt can
 * snapshot the business name + currency without a join or auth. */
@Injectable()
export class BusinessCacheConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(BusinessCacheConsumer.name);
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
      SUBJECTS.tenancy.businessCreated,
      (msg) => this.onBusinessCreated(msg.data),
      {
        durable: 'sales-business-created',
        maxDeliver: 5,
        dlqSubject: dlqSubject('tenancy', 'BusinessCreated'),
      },
    );
    this.logger.log('subscribed to tenancy.BusinessCreated');
  }

  async onBusinessCreated(raw: unknown): Promise<void> {
    const evt = businessCreated.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.tenancy.businessCreated,
      () =>
        this.prisma.salesBusiness.upsert({
          where: { businessId: evt.payload.business_id },
          create: {
            businessId: evt.payload.business_id,
            name: evt.payload.name,
            currency: evt.payload.currency,
          },
          update: { name: evt.payload.name, currency: evt.payload.currency },
        }),
    );
  }
}
