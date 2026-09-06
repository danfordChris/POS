import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';
import { IdentityClient } from '../rpc/identity-client.js';
import { TenancyClient } from '../rpc/tenancy-client.js';
import { WingerAccountsService } from './winger-accounts.service.js';
import { WingerAccountsController } from './winger-accounts.controller.js';
import { WingerCatalogService } from './winger-catalog.service.js';
import { WingerCatalogController } from './winger-catalog.controller.js';
import { WingerUserGuard } from './winger-user.guard.js';
import { CatalogProjectionConsumer } from './consumers/catalog-projection.consumer.js';
import { BusinessCacheConsumer } from './consumers/business-cache.consumer.js';

/** Winger feature module. */
@Module({
  imports: [TenantModule],
  controllers: [WingerAccountsController, WingerCatalogController],
  providers: [
    WingerAccountsService,
    WingerCatalogService,
    IdentityClient,
    TenancyClient,
    WingerUserGuard,
    CatalogProjectionConsumer,
    BusinessCacheConsumer,
    OutboxRelayService,
  ],
  exports: [
    WingerAccountsService,
    WingerCatalogService,
    CatalogProjectionConsumer,
    BusinessCacheConsumer,
  ],
})
export class WingerModule {}
