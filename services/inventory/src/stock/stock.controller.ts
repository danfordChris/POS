import {
  Body,
  Controller,
  Get,
  Headers,
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
import { StockService } from './stock.service.js';
import { RecordMovementDto } from './dto/record-movement.dto.js';
import { ListMovementsQuery, ListStockQuery } from './dto/list-queries.js';

@ApiTags('stock')
@Controller('businesses/:businessId/stock')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  listStock(
    @Param('businessId') businessId: string,
    @Query() query: ListStockQuery,
  ) {
    return this.stock.listStock(businessId, query);
  }

  @Get('movements')
  listMovements(
    @Param('businessId') businessId: string,
    @Query() query: ListMovementsQuery,
  ) {
    return this.stock.listMovements(businessId, query);
  }

  @Get('low')
  listLow(@Param('businessId') businessId: string) {
    return this.stock.listLowStock(businessId);
  }

  @Post('movements')
  @Roles('owner', 'staff')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  record(
    @Param('businessId') businessId: string,
    @Body() dto: RecordMovementDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const userId = req.internalContext!.user_id as string;
    return this.stock.recordMovement(
      businessId,
      userId,
      dto,
      idempotencyKey?.trim() || undefined,
    );
  }
}
