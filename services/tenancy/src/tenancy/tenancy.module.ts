import { Module } from '@nestjs/common';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from './tenant.guard.js';
import { RolesGuard } from './roles.decorator.js';

@Module({
  providers: [InternalContextGuard, TenantGuard, RolesGuard],
  exports: [InternalContextGuard, TenantGuard, RolesGuard],
})
export class TenancyModule {}
