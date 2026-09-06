import { Module } from '@nestjs/common';
import { HealthModule } from '@pos/nest-common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PlatformModule } from './platform/platform.module.js';
import { ContactsModule } from './contacts/contacts.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PlatformModule,
    ContactsModule,
    HealthModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        serviceName: 'notifications',
        checks: [{ name: 'db', check: () => prisma.pingDatabase() }],
      }),
    }),
  ],
})
export class AppModule {}
