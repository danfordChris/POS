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

const envelope = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.BusinessCreated,
});

/**
 * Reacts to `tenancy.BusinessCreated`. Catalog has no seed rows to create in the
 * MVP, so this is the bootstrap seam only: it proves the subscribe → idempotency
 * → DLQ path and is where per-business catalog defaults will be created later.
 * Idempotent on `event_id`.
 */
@Injectable()
export class BusinessCreatedConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(BusinessCreatedConsumer.name);
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

  /** Exposed for tests: wire the subscription against an injected bus. */
  async register(): Promise<void> {
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.tenancy.businessCreated,
      (msg) => this.handle(msg.data),
      {
        durable: 'catalog-business-created',
        maxDeliver: 5,
        dlqSubject: dlqSubject('tenancy', 'BusinessCreated'),
      },
    );
    this.logger.log('subscribed to tenancy.BusinessCreated');
  }

  async handle(raw: unknown): Promise<void> {
    const evt = envelope.parse(raw);
    const outcome = await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.tenancy.businessCreated,
      async () => {
        // Bootstrap hook — no catalog seed data in the MVP.
        this.logger.log(
          `catalog ready for business ${evt.payload.business_id}`,
        );
      },
    );
    if (outcome.skipped) {
      this.logger.debug(`event ${evt.event_id} already processed; skipping`);
    }
  }
}
