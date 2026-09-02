import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard, Roles } from '../tenant/roles.decorator.js';
import { CatalogService } from './catalog.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

@ApiTags('catalog')
@Controller('businesses/:businessId/categories')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Param('businessId') businessId: string) {
    return this.catalog.listCategories(businessId);
  }

  @Post()
  @Roles('owner', 'staff')
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.catalog.createCategory(businessId, dto);
  }
}
