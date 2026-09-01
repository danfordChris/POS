import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TenantGuard } from './tenant.guard.js';
import { RolesGuard } from './roles.decorator.js';

@Module({
  imports: [AuthModule],
  providers: [TenantGuard, RolesGuard],
  exports: [TenantGuard, RolesGuard],
})
export class TenancyModule {}
