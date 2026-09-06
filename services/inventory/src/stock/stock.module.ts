import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { StockService } from './stock.service.js';
import { StockController } from './stock.controller.js';
import { ProductEventsConsumer } from '../consumers/product-events.consumer.js';
import { SaleVoidedConsumer } from '../consumers/sale-voided.consumer.js';
import { InventoryRpc } from '../rpc/inventory.rpc.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';

@Module({
  imports: [TenantModule],
  controllers: [StockController],
  providers: [
    StockService,
    ProductEventsConsumer,
    SaleVoidedConsumer,
    InventoryRpc,
    OutboxRelayService,
  ],
  exports: [
    StockService,
    ProductEventsConsumer,
    SaleVoidedConsumer,
    OutboxRelayService,
  ],
})
export class StockModule {}
