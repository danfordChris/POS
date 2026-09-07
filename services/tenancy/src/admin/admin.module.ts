import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { IdentityClient } from '../rpc/tenancy.rpc.js';
import { OperatorGuard } from './operator.guard.js';
import { AdminService } from './admin.service.js';
import { SupportGrantsService } from './support-grants.service.js';
import { AdminController } from './admin.controller.js';
import { SupportGrantsController } from './support-grants.controller.js';

@Module({
  imports: [TenancyModule, BusinessesModule],
  controllers: [AdminController, SupportGrantsController],
  providers: [
    AdminService,
    SupportGrantsService,
    OperatorGuard,
    IdentityClient,
  ],
  exports: [AdminService, SupportGrantsService],
})
export class AdminModule {}
