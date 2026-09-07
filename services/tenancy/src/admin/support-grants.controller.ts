import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard, Roles } from '../tenancy/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { SupportGrantsService } from './support-grants.service.js';
import { ApproveGrantDto } from './dto/admin.dto.js';

/** Owner-side support-grant approval + the Owner's audit trail. */
@ApiTags('support-grants')
@Controller('businesses/:businessId')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
@Roles('owner')
export class SupportGrantsController {
  constructor(
    private readonly grants: SupportGrantsService,
    private readonly admin: AdminService,
  ) {}

  @Get('support-grants')
  list(@Param('businessId') businessId: string) {
    return this.grants.listForBusiness(businessId);
  }

  @Post('support-grants/:id/approve')
  approve(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: ApproveGrantDto,
    @Req() req: Request,
  ) {
    return this.grants.approve(
      businessId,
      id,
      req.internalContext!.user_id as string,
      dto.expires_at,
    );
  }

  @Post('support-grants/:id/revoke')
  revoke(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.grants.revoke(businessId, id);
  }

  @Get('audit-log')
  audit(@Param('businessId') businessId: string) {
    return this.admin.auditForBusiness(businessId);
  }
}
