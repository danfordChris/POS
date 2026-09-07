import { Module } from '@nestjs/common';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from './tenant.guard.js';

@Module({
  providers: [InternalContextGuard, TenantGuard],
  exports: [InternalContextGuard, TenantGuard],
})
export class TenantModule {}
