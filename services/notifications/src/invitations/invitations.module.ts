import { Module } from '@nestjs/common';
import { InvitationEmailService } from './invitation.service.js';
import { InvitationConsumer } from './invitation.consumer.js';

@Module({
  providers: [InvitationEmailService, InvitationConsumer],
  exports: [InvitationEmailService, InvitationConsumer],
})
export class InvitationsModule {}
