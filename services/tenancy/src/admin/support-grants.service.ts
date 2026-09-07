import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_GRANT_MS = 24 * 3_600_000;

export interface GrantView {
  id: string;
  business_id: string;
  operator_id: string;
  reason: string;
  status: string;
  approved_by: string | null;
  granted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function toView(g: {
  id: string;
  businessId: string;
  operatorId: string;
  reason: string;
  status: string;
  approvedBy: string | null;
  grantedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): GrantView {
  return {
    id: g.id,
    business_id: g.businessId,
    operator_id: g.operatorId,
    reason: g.reason,
    status: g.status,
    approved_by: g.approvedBy,
    granted_at: g.grantedAt?.toISOString() ?? null,
    expires_at: g.expiresAt?.toISOString() ?? null,
    revoked_at: g.revokedAt?.toISOString() ?? null,
    created_at: g.createdAt.toISOString(),
  };
}

@Injectable()
export class SupportGrantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Operator requests break-glass for a business. */
  async request(
    operatorId: string,
    businessId: string,
    reason: string,
  ): Promise<GrantView> {
    if (!reason.trim()) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'A reason is required',
      });
    }
    const grant = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.supportAccessGrant.create({
        data: {
          businessId,
          operatorId,
          reason: reason.trim(),
          status: 'pending',
        },
      }),
    );
    return toView(grant);
  }

  /** Operator lists their own grants (cross-business; relaxed read). */
  async listForOperator(operatorId: string): Promise<GrantView[]> {
    const rows = await this.prisma.supportAccessGrant.findMany({
      where: { operatorId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toView);
  }

  /** Owner lists grants for their business. */
  async listForBusiness(businessId: string): Promise<GrantView[]> {
    const rows = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.supportAccessGrant.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map(toView);
  }

  /** Owner approves; `expires_at` is capped at `granted_at + 24h`. */
  async approve(
    businessId: string,
    grantId: string,
    approvedBy: string,
    requestedExpiry?: string,
  ): Promise<GrantView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const grant = await tx.supportAccessGrant.findUnique({
        where: { id: grantId },
      });
      if (!grant || grant.businessId !== businessId) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Grant not found',
        });
      }
      if (grant.status !== 'pending') {
        throw new ForbiddenException({
          code: 'conflict',
          message: `Grant is already ${grant.status}`,
        });
      }
      const now = Date.now();
      const cap = now + MAX_GRANT_MS;
      const wanted = requestedExpiry ? Date.parse(requestedExpiry) : cap;
      const expiresAt = new Date(
        Math.min(Number.isFinite(wanted) ? wanted : cap, cap),
      );
      const updated = await tx.supportAccessGrant.update({
        where: { id: grantId },
        data: {
          status: 'approved',
          approvedBy,
          grantedAt: new Date(now),
          expiresAt,
        },
      });
      return toView(updated);
    });
  }

  /** Owner revokes. */
  async revoke(businessId: string, grantId: string): Promise<GrantView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const grant = await tx.supportAccessGrant.findUnique({
        where: { id: grantId },
      });
      if (!grant || grant.businessId !== businessId) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Grant not found',
        });
      }
      const updated = await tx.supportAccessGrant.update({
        where: { id: grantId },
        data: { status: 'revoked', revokedAt: new Date() },
      });
      return toView(updated);
    });
  }

  /** True iff `operatorId` holds an approved, unexpired, unrevoked grant for
   * `businessId`. Read is unscoped (relaxed policy) — safe, filtered by ids. */
  async hasActiveGrant(
    operatorId: string,
    businessId: string,
  ): Promise<boolean> {
    const grant = await this.prisma.supportAccessGrant.findFirst({
      where: {
        operatorId,
        businessId,
        status: 'approved',
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    return grant !== null;
  }
}
