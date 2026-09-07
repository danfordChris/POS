import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';
import { ObjectStore } from './object-store.js';
import { DocumentService } from './document.service.js';
import { InvoiceIssuedConsumer } from './invoice-issued.consumer.js';
import { MediaRpc } from './media.rpc.js';
import { InvoicePdfController, InvoicePdfPublicController } from './invoice-pdf.controller.js';

@Module({
  imports: [TenantModule],
  controllers: [InvoicePdfController, InvoicePdfPublicController],
  providers: [ObjectStore, DocumentService, InvoiceIssuedConsumer, MediaRpc, OutboxRelayService],
  exports: [DocumentService, InvoiceIssuedConsumer],
})
export class InvoicesModule {}
