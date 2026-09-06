import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
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
}
