import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { OutboxRelayService } from '../platform/outbox-relay.service.js';
import { DigestConfigConsumer } from './digest-config.consumer.js';
import { DigestFlushJob } from './digest-flush.job.js';

@Module({
  imports: [EmailModule],
  providers: [DigestConfigConsumer, DigestFlushJob, OutboxRelayService],
  exports: [DigestConfigConsumer, DigestFlushJob],
})
export class DigestModule {}
