import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NatsModule } from '@pos/nest-common';

/** Connects the real NATS bus. `NatsModule` provides `MESSAGE_BUS` globally. */
@Module({
  imports: [
    NatsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.getOrThrow<string>('NATS_URL'),
        name: 'identity',
      }),
    }),
  ],
})
export class PlatformModule {}
