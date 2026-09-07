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
import { InvoiceEmailService } from './invoice-email.service.js';

const issued = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.InvoiceIssued,
});
const paid = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.InvoicePaymentRecorded,
});
const voided = messageEnvelopeSchema.extend({
  payload: EVENT_PAYLOADS.InvoiceVoided,
});

/** `sales.InvoiceIssued` → an `invoice_issued` email + open-invoice projection. */
@Injectable()
export class NotifInvoiceIssuedConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotifInvoiceIssuedConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly service: InvoiceEmailService,
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
      SUBJECTS.sales.invoiceIssued,
      (msg) => this.onEvent(msg.data),
      {
        durable: 'notifications-invoice-issued',
        maxDeliver: 5,
        dlqSubject: dlqSubject('sales', 'InvoiceIssued'),
      },
    );
    this.logger.log('subscribed to sales.InvoiceIssued');
  }

  async onEvent(raw: unknown): Promise<void> {
    const evt = issued.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.sales.invoiceIssued,
      () => this.service.recordIssued(evt.payload),
    );
  }
}

/** `sales.InvoicePaymentRecorded` → a `payment_received` email + projection update. */
@Injectable()
export class NotifInvoicePaymentConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotifInvoicePaymentConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly service: InvoiceEmailService,
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
      SUBJECTS.sales.invoicePaymentRecorded,
      (msg) => this.onEvent(msg.data),
      {
        durable: 'notifications-invoice-payment',
        maxDeliver: 5,
        dlqSubject: dlqSubject('sales', 'InvoicePaymentRecorded'),
      },
    );
    this.logger.log('subscribed to sales.InvoicePaymentRecorded');
  }

  async onEvent(raw: unknown): Promise<void> {
    const evt = paid.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.sales.invoicePaymentRecorded,
      () => this.service.recordPayment(evt.payload),
    );
  }
}

/** `sales.InvoiceVoided` → drop the open-invoice projection row. */
@Injectable()
export class NotifInvoiceVoidedConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotifInvoiceVoidedConsumer.name);
  private readonly idempotency: PrismaIdempotencyStore;

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
    private readonly service: InvoiceEmailService,
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
      SUBJECTS.sales.invoiceVoided,
      (msg) => this.onEvent(msg.data),
      {
        durable: 'notifications-invoice-voided',
        maxDeliver: 5,
        dlqSubject: dlqSubject('sales', 'InvoiceVoided'),
      },
    );
    this.logger.log('subscribed to sales.InvoiceVoided');
  }

  async onEvent(raw: unknown): Promise<void> {
    const evt = voided.parse(raw);
    await runIdempotent(
      this.idempotency,
      evt.event_id,
      SUBJECTS.sales.invoiceVoided,
      () => this.service.onVoided(evt.payload),
    );
  }
}
