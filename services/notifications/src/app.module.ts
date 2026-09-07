import { Module } from '@nestjs/common';
import { HealthModule } from '@pos/nest-common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PlatformModule } from './platform/platform.module.js';
import { EmailModule } from './email/email.module.js';
import { TemplatesModule } from './templates/templates.module.js';
import { ContactsModule } from './contacts/contacts.module.js';
import { LowStockModule } from './low-stock/low-stock.module.js';
import { DigestModule } from './digest/digest.module.js';
import { WingerModule } from './winger/winger.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PlatformModule,
    EmailModule,
    TemplatesModule,
    ContactsModule,
    LowStockModule,
    DigestModule,
    WingerModule,
    InvitationsModule,
    InvoicesModule,
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
