import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';
import { InventoryClient } from '../rpc/inventory-client.js';
import { SalesService } from './sales.service.js';
import { SalesController } from './sales.controller.js';
import { ProductCacheConsumer } from './consumers/product-cache.consumer.js';
import { BusinessCacheConsumer } from './consumers/business-cache.consumer.js';

@Module({
  imports: [TenantModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    InventoryClient,
    ProductCacheConsumer,
    BusinessCacheConsumer,
    OutboxRelayService,
  ],
  exports: [SalesService, ProductCacheConsumer, BusinessCacheConsumer],
})
export class SalesModule {}
