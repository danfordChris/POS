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
import { WingerAuthorizedService } from './winger-authorized.service.js';

const authorized = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.WingerAuthorized,
});

/** `winger.WingerAuthorized` → a `winger_authorized` email to the reseller.
 * Idempotent on `event_id`; also deduped on `winger_account_id`. */
@Injectable()
export class WingerAuthorizedConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(WingerAuthorizedConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly service: WingerAuthorizedService,
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
      SUBJECTS.winger.wingerAuthorized,
      (msg) => this.onAuthorized(msg.data),
      {
        durable: 'notifications-winger-authorized',
        maxDeliver: 5,
        dlqSubject: dlqSubject('winger', 'WingerAuthorized'),
      },
    );
    this.logger.log('subscribed to winger.WingerAuthorized');
  }

  async onAuthorized(raw: unknown): Promise<void> {
    const evt = authorized.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.winger.wingerAuthorized,
      () => this.service.record(evt.payload),
    );
  }
}
