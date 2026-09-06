import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard, Roles } from '../tenant/roles.decorator.js';
import { AlertConfigService } from './alert-config.service.js';
import { PutAlertConfigDto } from './dto/put-alert-config.dto.js';

@ApiTags('alert-config')
@Controller('businesses/:businessId/alert-config')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
@Roles('owner')
export class AlertConfigController {
  constructor(private readonly alertConfig: AlertConfigService) {}

  @Get()
  get(@Param('businessId') businessId: string) {
    return this.alertConfig.get(businessId);
  }

  @Put()
  put(@Param('businessId') businessId: string, @Body() dto: PutAlertConfigDto) {
    return this.alertConfig.put(businessId, dto);
  }
}
