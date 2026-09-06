import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { LowStockConsumer } from './low-stock.consumer.js';

@Module({
  providers: [NotificationService, LowStockConsumer],
  exports: [NotificationService, LowStockConsumer],
})
export class LowStockModule {}
