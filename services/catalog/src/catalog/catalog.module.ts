import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { CatalogService } from './catalog.service.js';
import { CategoriesController } from './categories.controller.js';
import { ProductsController } from './products.controller.js';
import { MediaService } from '../media/media.service.js';
import { BusinessCreatedConsumer } from '../consumers/business-created.consumer.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';

@Module({
  imports: [TenantModule],
  controllers: [CategoriesController, ProductsController],
  providers: [
    CatalogService,
    MediaService,
    BusinessCreatedConsumer,
    OutboxRelayService,
  ],
  exports: [CatalogService, OutboxRelayService, BusinessCreatedConsumer],
})
export class CatalogModule {}
