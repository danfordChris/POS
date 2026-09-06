import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';
import { IdentityClient } from '../rpc/identity-client.js';
import { TenancyClient } from '../rpc/tenancy-client.js';
import { WingerAccountsService } from './winger-accounts.service.js';
import { WingerAccountsController } from './winger-accounts.controller.js';

/**
 * Winger feature module. The catalog projection consumers (T-0403) and the
 * winger reader endpoints (T-0404) register their providers here.
 */
@Module({
  imports: [TenantModule],
  controllers: [WingerAccountsController],
  providers: [
    WingerAccountsService,
    IdentityClient,
    TenancyClient,
    OutboxRelayService,
  ],
  exports: [WingerAccountsService],
})
export class WingerModule {}
