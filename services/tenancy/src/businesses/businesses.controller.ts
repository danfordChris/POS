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
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard, Roles } from '../tenancy/roles.decorator.js';
import { BusinessesService } from './businesses.service.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';
import { SetMemberStatusDto } from './dto/set-member-status.dto.js';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  @UseGuards(InternalContextGuard)
  create(@Req() req: Request, @Body() dto: CreateBusinessDto) {
    // The gateway verified the JWT; the caller (internalContext.user_id) becomes owner.
    return this.businesses.create(req.internalContext!.user_id as string, dto);
  }

  @Get(':businessId')
  @UseGuards(InternalContextGuard, TenantGuard)
  get(@Param('businessId') businessId: string) {
    return this.businesses.get(businessId);
  }

  @Patch(':businessId')
  @UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  update(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businesses.update(businessId, dto);
  }

  @Get(':businessId/members')
  @UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  listMembers(@Param('businessId') businessId: string) {
    return this.businesses.listMembers(businessId);
  }

  @Patch(':businessId/members/:userId')
  @UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  setMemberStatus(
    @Param('businessId') businessId: string,
    @Param('userId') userId: string,
    @Body() dto: SetMemberStatusDto,
  ) {
    return this.businesses.setMemberStatus(businessId, userId, dto.status);
  }
}
