import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard, Roles } from '../tenant/roles.decorator.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { ListCustomersQuery } from './dto/list-customers.dto.js';

@ApiTags('customers')
@Controller('businesses/:businessId/customers')
@UseGuards(InternalContextGuard, TenantGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @Roles('owner', 'staff')
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customers.create(businessId, dto);
  }

  @Get()
  @Roles('owner', 'staff')
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListCustomersQuery,
  ) {
    return this.customers.list(businessId, query);
  }

  @Get(':id')
  @Roles('owner', 'staff')
  get(@Param('businessId') businessId: string, @Param('id') id: string) {
    return this.customers.get(businessId, id);
  }

  @Patch(':id')
  @Roles('owner', 'staff')
  update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(businessId, id, dto);
  }
}
