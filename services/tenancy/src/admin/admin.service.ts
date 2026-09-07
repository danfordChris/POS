import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { IdentityClient } from '../rpc/tenancy.rpc.js';
import { SupportGrantsService } from './support-grants.service.js';

export interface AdminBusinessSummary {
  id: string;
  name: string;
  subscription_status: string;
  member_count: number;
  created_at: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grants: SupportGrantsService,
    private readonly businesses: BusinessesService,
    private readonly identity: IdentityClient,
  ) {}

  /** Control-plane provisioning: create a business + its first Owner (resolved
   * or provisioned from `owner_email`). */
  async provisionBusiness(input: {
    name: string;
    owner_email: string;
    currency?: string;
    locale?: string;
  }): Promise<AdminBusinessSummary> {
    let ownerId: string;
    try {
      const user = await this.identity.getUser({
        email: input.owner_email,
        create: true,
      });
      if (!user.found) {
        throw new BadRequestException({
          code: 'owner_unresolved',
          message: 'Could not resolve or create the owner user',
        });
      }
      ownerId = user.user_id;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new ServiceUnavailableException({
        code: 'upstream_unavailable',
        message: 'Identity service is unavailable. Try again shortly.',
      });
    }

    const business = await this.businesses.create(ownerId, {
      name: input.name,
      currency: input.currency,
      locale: input.locale,
    });
    return {
      id: business.id,
      name: business.name,
      subscription_status: business.subscriptionStatus,
      member_count: 1,
      created_at: business.createdAt.toISOString(),
    };
  }

  /** Control-plane list: id / name / subscription_status / member count only —
   * never row contents. Read is unscoped by design (operator control-plane). */
  async listBusinesses(): Promise<AdminBusinessSummary[]> {
    const rows = await this.prisma.business.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const counts = await this.prisma.membership.groupBy({
      by: ['businessId'],
      _count: { _all: true },
    });
    const countBy = new Map(counts.map((c) => [c.businessId, c._count._all]));
    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      subscription_status: b.subscriptionStatus,
      member_count: countBy.get(b.id) ?? 0,
      created_at: b.createdAt.toISOString(),
    }));
  }

  async setSubscriptionStatus(
    businessId: string,
    status: string,
  ): Promise<AdminBusinessSummary> {
    try {
      const b = await this.prisma.runInTenantContext(businessId, (tx) =>
        tx.business.update({
          where: { id: businessId },
          data: { subscriptionStatus: status },
        }),
      );
      const member_count = await this.prisma.runInTenantContext(
        businessId,
        (tx) => tx.membership.count({ where: { businessId } }),
      );
      return {
        id: b.id,
        name: b.name,
        subscription_status: b.subscriptionStatus,
        member_count,
        created_at: b.createdAt.toISOString(),
      };
    } catch {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Business not found',
      });
    }
  }

  /** Grant-gated: row-level tenant data (business + members) is returned ONLY
   * while the operator holds an active grant, and every read writes an
   * `audit_log` row. Otherwise `403 operator_data_access_denied`. */
  async businessDetailUnderGrant(
    operatorId: string,
    businessId: string,
  ): Promise<{
    id: string;
    name: string;
    subscription_status: string;
    members: { user_id: string; role: string; status: string }[];
  }> {
    const allowed = await this.grants.hasActiveGrant(operatorId, businessId);
    if (!allowed) {
      throw new ForbiddenException({
        code: 'operator_data_access_denied',
        message: 'No active support grant for this business',
      });
    }

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
      });
      if (!business) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Business not found',
        });
      }
      const members = await tx.membership.findMany({
        orderBy: { joinedAt: 'asc' },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          actorId: operatorId,
          actorType: 'operator',
          action: 'business.detail.read',
          targetType: 'business',
          targetId: businessId,
          metadata: { member_count: members.length },
        },
      });
      return {
        id: business.id,
        name: business.name,
        subscription_status: business.subscriptionStatus,
        members: members.map((m) => ({
          user_id: m.userId,
          role: m.role,
          status: m.status,
        })),
      };
    });
  }

  /** Owner-visible audit trail for their business. */
  async auditForBusiness(businessId: string) {
    return this.prisma.runInTenantContext(businessId, (tx) =>
      tx.auditLog.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }
}
