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

const alertConfigChanged = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.AlertConfigChanged,
});

/** Projects inventory's `AlertConfigChanged` into `digest_config` so the flush
 * job knows each business's window length without a sync call. */
@Injectable()
export class DigestConfigConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(DigestConfigConsumer.name);
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
      SUBJECTS.inventory.alertConfigChanged,
      (msg) => this.onChanged(msg.data),
      {
        durable: 'notifications-alert-config-changed',
        maxDeliver: 5,
        dlqSubject: dlqSubject('inventory', 'AlertConfigChanged'),
      },
    );
    this.logger.log('subscribed to inventory.AlertConfigChanged');
  }

  async onChanged(raw: unknown): Promise<void> {
    const evt = alertConfigChanged.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.inventory.alertConfigChanged,
      async () => {
        const { business_id, min_interval_hours, recipients } = evt.payload;
        await this.prisma.digestConfig.upsert({
          where: { businessId: business_id },
          create: {
            businessId: business_id,
            minIntervalHours: min_interval_hours,
            recipients,
          },
          update: { minIntervalHours: min_interval_hours, recipients },
        });
      },
    );
  }
}
