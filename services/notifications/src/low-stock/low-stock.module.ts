import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';
import { NotificationService } from './notification.service.js';
import { LowStockConsumer } from './low-stock.consumer.js';
import { SendWorker } from './send-worker.js';

@Module({
  imports: [EmailModule],
  providers: [
    NotificationService,
    LowStockConsumer,
    SendWorker,
    OutboxRelayService,
  ],
  exports: [NotificationService, LowStockConsumer, SendWorker],
})
export class LowStockModule {}
