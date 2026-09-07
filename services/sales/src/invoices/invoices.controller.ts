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
import { InvoicesService } from './invoices.service.js';
import { ListInvoicesQuery } from './dto/list-invoices.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { RecordPaymentDto } from './dto/record-payment.dto.js';
import { VoidInvoiceDto } from './dto/void-invoice.dto.js';

type Role = 'owner' | 'staff';

@ApiTags('invoices')
@Controller('businesses/:businessId/invoices')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @Roles('owner', 'staff')
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoices.issueStandalone(businessId, dto);
  }

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

  @Post(':id/payments')
  @Roles('owner', 'staff')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  recordPayment(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.invoices.recordPayment(
      businessId,
      id,
      req.internalContext!.user_id as string,
      dto,
      idempotencyKey?.trim() || undefined,
    );
  }

  @Post(':id/void')
  @HttpCode(200)
  @Roles('owner')
  void(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.invoices.voidInvoice(businessId, id, dto);
  }
}
