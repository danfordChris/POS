import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InternalContextGuard } from '@pos/nest-common';
import { WingerUserGuard } from './winger-user.guard.js';
import { WingerCatalogService } from './winger-catalog.service.js';
import { ListWingerProductsQuery } from './dto/list-products.dto.js';

@ApiTags('winger')
@Controller('winger')
@UseGuards(InternalContextGuard, WingerUserGuard)
export class WingerCatalogController {
  constructor(private readonly catalog: WingerCatalogService) {}

  @Get('businesses')
  listBusinesses(@Req() req: Request) {
    return this.catalog.listBusinesses(req.internalContext!.user_id as string);
  }

  @Get('businesses/:businessId/products')
  listProducts(
    @Param('businessId') businessId: string,
    @Query() query: ListWingerProductsQuery,
    @Req() req: Request,
  ) {
    return this.catalog.listProducts(
      req.internalContext!.user_id as string,
      businessId,
      query,
    );
  }
}
