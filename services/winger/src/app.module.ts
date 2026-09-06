import { Module } from '@nestjs/common';
import { HealthModule } from '@pos/nest-common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PlatformModule } from './platform/platform.module.js';
import { WingerModule } from './winger/winger.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PlatformModule,
    WingerModule,
    HealthModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        serviceName: 'winger',
        checks: [{ name: 'db', check: () => prisma.pingDatabase() }],
      }),
    }),
  ],
})
export class AppModule {}
