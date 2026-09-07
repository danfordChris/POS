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
import { InvitationsService } from './invitations.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';

@ApiTags('invitations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('businesses/:businessId/invitations')
  @UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: Request,
  ) {
    return this.invitations.create(
      businessId,
      req.internalContext!.user_id as string,
      dto.email,
    );
  }

  @Get('businesses/:businessId/invitations')
  @UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  list(@Param('businessId') businessId: string) {
    return this.invitations.list(businessId);
  }

  @Post('businesses/:businessId/invitations/:id/revoke')
  @UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  revoke(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.invitations.revoke(businessId, id);
  }

  /** Not business-scoped: the invitee is authenticated but not yet a member. */
  @Post('invitations/accept')
  @UseGuards(InternalContextGuard)
  accept(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    return this.invitations.accept(
      req.internalContext!.user_id as string,
      dto.token,
    );
  }
}
