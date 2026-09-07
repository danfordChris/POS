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
import { InvitationEmailService } from './invitation.service.js';

const created = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.InvitationCreated,
});

/** `tenancy.InvitationCreated` → an `invitation` email to the invitee.
 * Idempotent on `event_id`; also deduped on `invitation_id`. */
@Injectable()
export class InvitationConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(InvitationConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly service: InvitationEmailService,
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
      SUBJECTS.tenancy.invitationCreated,
      (msg) => this.onCreated(msg.data),
      {
        durable: 'notifications-invitation-created',
        maxDeliver: 5,
        dlqSubject: dlqSubject('tenancy', 'InvitationCreated'),
      },
    );
    this.logger.log('subscribed to tenancy.InvitationCreated');
  }

  async onCreated(raw: unknown): Promise<void> {
    const evt = created.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.tenancy.invitationCreated,
      () => this.service.record(evt.payload),
    );
  }
}
