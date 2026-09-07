import { Module } from '@nestjs/common';
import { InvoiceEmailService } from './invoice-email.service.js';
import {
  NotifInvoiceIssuedConsumer,
  NotifInvoicePaymentConsumer,
  NotifInvoiceVoidedConsumer,
} from './invoice.consumers.js';
import { OverdueSweepJob } from './overdue-sweep.job.js';

@Module({
  providers: [
    InvoiceEmailService,
    NotifInvoiceIssuedConsumer,
    NotifInvoicePaymentConsumer,
    NotifInvoiceVoidedConsumer,
    OverdueSweepJob,
  ],
  exports: [
    InvoiceEmailService,
    NotifInvoiceIssuedConsumer,
    NotifInvoicePaymentConsumer,
    NotifInvoiceVoidedConsumer,
    OverdueSweepJob,
  ],
})
export class InvoicesModule {}
