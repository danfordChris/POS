import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module.js';
import { AlertConfigService } from './alert-config.service.js';
import { AlertConfigController } from './alert-config.controller.js';

@Module({
  imports: [TenantModule],
  controllers: [AlertConfigController],
  providers: [AlertConfigService],
  exports: [AlertConfigService],
})
export class AlertConfigModule {}
