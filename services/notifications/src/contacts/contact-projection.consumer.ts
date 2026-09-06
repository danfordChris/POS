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
import { ContactService } from './contact.service.js';

const businessCreated = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.BusinessCreated,
});
const membershipCreated = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.MembershipCreated,
});
const membershipSuspended = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.MembershipSuspended,
});

/**
 * Builds `notification_contact` from tenancy events so recipient resolution
 * never needs a sync call to `tenancy`. Idempotent on `event_id`; poison
 * messages dead-letter after `maxDeliver`.
 */
@Injectable()
export class ContactProjectionConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContactProjectionConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly contacts: ContactService,
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
      SUBJECTS.tenancy.businessCreated,
      (msg) => this.onBusinessCreated(msg.data),
      {
        durable: 'notifications-business-created',
        maxDeliver: 5,
        dlqSubject: dlqSubject('tenancy', 'BusinessCreated'),
      },
    );
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.tenancy.membershipCreated,
      (msg) => this.onMembershipCreated(msg.data),
      {
        durable: 'notifications-membership-created',
        maxDeliver: 5,
        dlqSubject: dlqSubject('tenancy', 'MembershipCreated'),
      },
    );
    await subscribeWithDlq(
      this.bus,
      SUBJECTS.tenancy.membershipSuspended,
      (msg) => this.onMembershipSuspended(msg.data),
      {
        durable: 'notifications-membership-suspended',
        maxDeliver: 5,
        dlqSubject: dlqSubject('tenancy', 'MembershipSuspended'),
      },
    );
    this.logger.log(
      'subscribed to tenancy.BusinessCreated / MembershipCreated / MembershipSuspended',
    );
  }

  async onBusinessCreated(raw: unknown): Promise<void> {
    const evt = businessCreated.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.tenancy.businessCreated,
      () =>
        this.contacts.upsert({
          businessId: evt.payload.business_id,
          userId: evt.payload.owner_user_id,
          role: 'owner',
          email: evt.payload.owner_email ?? null,
          locale: evt.payload.owner_locale ?? evt.payload.locale,
        }),
    );
  }

  async onMembershipCreated(raw: unknown): Promise<void> {
    const evt = membershipCreated.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.tenancy.membershipCreated,
      () =>
        this.contacts.upsert({
          businessId: evt.payload.business_id,
          userId: evt.payload.user_id,
          role: evt.payload.role,
          email: evt.payload.email ?? null,
          locale: evt.payload.locale ?? null,
        }),
    );
  }

  async onMembershipSuspended(raw: unknown): Promise<void> {
    const evt = membershipSuspended.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.tenancy.membershipSuspended,
      () => this.contacts.suspend(evt.payload.business_id, evt.payload.user_id),
    );
  }
}
