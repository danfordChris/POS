import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InternalContextGuard } from '@pos/nest-common';
import { OperatorGuard } from './operator.guard.js';
import { AdminService } from './admin.service.js';
import { SupportGrantsService } from './support-grants.service.js';
import {
  PatchSubscriptionDto,
  ProvisionBusinessDto,
  RequestGrantDto,
} from './dto/admin.dto.js';

/** Control-plane. Audience `operator` (edge route has `require_business_scope: false`). */
@ApiTags('admin')
@Controller('admin')
@UseGuards(InternalContextGuard, OperatorGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly grants: SupportGrantsService,
  ) {}

  @Post('businesses')
  provision(@Body() dto: ProvisionBusinessDto) {
    return this.admin.provisionBusiness(dto);
  }

  @Get('businesses')
  listBusinesses() {
    return this.admin.listBusinesses();
  }

  @Patch('businesses/:id')
  patch(@Param('id') id: string, @Body() dto: PatchSubscriptionDto) {
    return this.admin.setSubscriptionStatus(id, dto.subscription_status);
  }

  /** Row-level tenant data — returned only under an active grant; every read is audited. */
  @Get('businesses/:id/detail')
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.admin.businessDetailUnderGrant(
      req.internalContext!.user_id as string,
      id,
    );
  }

  @Post('support-grants')
  requestGrant(@Body() dto: RequestGrantDto, @Req() req: Request) {
    return this.grants.request(
      req.internalContext!.user_id as string,
      dto.business_id,
      dto.reason,
    );
  }

  @Get('support-grants')
  listGrants(@Req() req: Request) {
    return this.grants.listForOperator(req.internalContext!.user_id as string);
  }
}
