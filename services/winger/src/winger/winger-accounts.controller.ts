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
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard, Roles } from '../tenant/roles.decorator.js';
import { WingerAccountsService } from './winger-accounts.service.js';
import { AuthorizeWingerDto } from './dto/authorize-winger.dto.js';
import { SetWingerStatusDto } from './dto/set-winger-status.dto.js';

@ApiTags('winger-accounts')
@Controller('businesses/:businessId/winger-accounts')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
export class WingerAccountsController {
  constructor(private readonly accounts: WingerAccountsService) {}

  @Post()
  @Roles('owner')
  authorize(
    @Param('businessId') businessId: string,
    @Body() dto: AuthorizeWingerDto,
    @Req() req: Request,
  ) {
    return this.accounts.authorize(
      businessId,
      req.internalContext!.user_id as string,
      dto,
    );
  }

  @Get()
  @Roles('owner')
  list(@Param('businessId') businessId: string) {
    return this.accounts.list(businessId);
  }

  @Patch(':id')
  @Roles('owner')
  setStatus(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: SetWingerStatusDto,
  ) {
    return this.accounts.setStatus(businessId, id, dto.status);
  }
}
