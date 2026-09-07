import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';
import { InventoryClient } from '../rpc/inventory-client.js';
import { SalesService } from './sales.service.js';
import { SalesController } from './sales.controller.js';
import { ReceiptController } from './receipt.controller.js';
import { ProductCacheConsumer } from './consumers/product-cache.consumer.js';
import { BusinessCacheConsumer } from './consumers/business-cache.consumer.js';
import { CustomersService } from '../customers/customers.service.js';
import { CustomersController } from '../customers/customers.controller.js';

@Module({
  imports: [TenantModule],
  controllers: [SalesController, ReceiptController, CustomersController],
  providers: [
    SalesService,
    CustomersService,
    InventoryClient,
    ProductCacheConsumer,
    BusinessCacheConsumer,
    OutboxRelayService,
  ],
  exports: [
    SalesService,
    CustomersService,
    ProductCacheConsumer,
    BusinessCacheConsumer,
  ],
})
export class SalesModule {}
