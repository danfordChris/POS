import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard, Roles } from '../tenant/roles.decorator.js';
import { InvoicesService } from './invoices.service.js';
import { ListInvoicesQuery } from './dto/list-invoices.dto.js';

type Role = 'owner' | 'staff';

@ApiTags('invoices')
@Controller('businesses/:businessId/invoices')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @Roles('owner', 'staff')
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListInvoicesQuery,
    @Req() req: Request,
  ) {
    return this.invoices.list(
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
    return this.invoices.get(
      businessId,
      req.membership!.role as Role,
      req.internalContext!.user_id as string,
      id,
    );
  }
}
