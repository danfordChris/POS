import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-subject.decorator.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard, Roles } from '../tenancy/roles.decorator.js';
import { BusinessesService } from './businesses.service.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';

@ApiTags('businesses')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  @UseGuards(UserAuthGuard)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBusinessDto) {
    return this.businesses.create(user.id, dto);
  }

  @Get(':businessId')
  @UseGuards(TenantGuard)
  get(@Param('businessId') businessId: string) {
    return this.businesses.get(businessId);
  }

  @Patch(':businessId')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  update(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businesses.update(businessId, dto);
  }
}
