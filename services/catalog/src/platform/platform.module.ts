import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NatsModule } from '@pos/nest-common';

@Module({
  imports: [
    NatsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.getOrThrow<string>('NATS_URL'),
        name: 'catalog',
      }),
    }),
  ],
})
export class PlatformModule {}
