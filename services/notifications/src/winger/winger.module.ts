import { Module } from '@nestjs/common';
import { WingerAuthorizedService } from './winger-authorized.service.js';
import { WingerAuthorizedConsumer } from './winger-authorized.consumer.js';

@Module({
  providers: [WingerAuthorizedService, WingerAuthorizedConsumer],
  exports: [WingerAuthorizedService, WingerAuthorizedConsumer],
})
export class WingerModule {}
