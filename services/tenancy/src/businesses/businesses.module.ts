import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';
import { InternalController } from '../internal/internal.controller.js';
import { InternalApiKeyGuard } from '../internal/internal.controller.js';
import { TenancyRpc, IdentityClient } from '../rpc/tenancy.rpc.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';

@Module({
  imports: [TenancyModule],
  controllers: [BusinessesController, InternalController],
  providers: [
    BusinessesService,
    InternalApiKeyGuard,
    TenancyRpc,
    IdentityClient,
    OutboxRelayService,
  ],
  exports: [BusinessesService, OutboxRelayService],
})
export class BusinessesModule {}
