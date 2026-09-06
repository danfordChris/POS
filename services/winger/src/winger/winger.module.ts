import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';

/**
 * Winger feature module. Scaffold only — the Owner winger-account endpoints
 * (T-0402), the catalog projection consumers (T-0403) and the winger reader
 * endpoints (T-0404) register their controllers / providers here.
 */
@Module({
  imports: [TenantModule],
  controllers: [],
  providers: [OutboxRelayService],
  exports: [],
})
export class WingerModule {}
