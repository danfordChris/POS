import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { IdentityClient } from '../rpc/tenancy.rpc.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';
import { InvitationsService } from './invitations.service.js';
import { InvitationsController } from './invitations.controller.js';

@Module({
  imports: [TenancyModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, IdentityClient, OutboxRelayService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
