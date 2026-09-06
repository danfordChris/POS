import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard, Roles } from '../tenant/roles.decorator.js';
import { SalesService } from './sales.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { ListSalesQuery } from './dto/list-sales.dto.js';

type Role = 'owner' | 'staff';

@ApiTags('sales')
@Controller('businesses/:businessId/sales')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @Roles('owner', 'staff')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateSaleDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const userId = req.internalContext!.user_id as string;
    return this.sales.createSale(
      businessId,
      userId,
      dto,
      idempotencyKey?.trim() || undefined,
    );
  }

  @Get()
  @Roles('owner', 'staff')
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListSalesQuery,
    @Req() req: Request,
  ) {
    return this.sales.listSales(
      businessId,
      req.membership!.role as Role,
      req.internalContext!.user_id as string,
      query,
    );
  }

  @Get(':id')
  @Roles('owner', 'staff')
  get(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.sales.getSale(
      businessId,
      req.membership!.role as Role,
      req.internalContext!.user_id as string,
      id,
    );
  }

  @Post(':id/void')
  @HttpCode(200)
  @Roles('owner')
  void(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.sales.voidSale(businessId, id);
  }
}
