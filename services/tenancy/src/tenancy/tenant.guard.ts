import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards `/v1/businesses/:businessId/*`. Trusts the gateway-signed internal
 * context (validated upstream by `InternalContextGuard`), refuses operator
 * callers, then re-checks the caller's membership against this service's own
 * RLS-scoped DB (defense in depth) and attaches `req.membership`.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ctx = request.internalContext;

    if (!ctx) {
      throw new HttpException(
        {
          code: 'internal_context_invalid',
          message: 'Missing internal context',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (ctx.token_kind === 'operator') {
      throw new ForbiddenException({
        code: 'operator_data_access_denied',
        message: 'Operators cannot access tenant data',
      });
    }
    if (ctx.token_kind !== 'user' || !ctx.user_id) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'Not an active member of this business',
      });
    }

    const raw = request.params.businessId;
    const businessId = typeof raw === 'string' ? raw : '';
    if (!businessId || !UUID_RE.test(businessId)) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'Unknown business',
      });
    }
    // The gateway resolves business_id from the same path; a mismatch is tampering.
    if (ctx.business_id && ctx.business_id !== businessId) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'Internal context does not match the requested business',
        userMessage: 'You do not have access to this business.',
      });
    }

    const membership = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.membership.findUnique({
        where: {
          businessId_userId: { businessId, userId: ctx.user_id as string },
        },
      }),
    );

    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'Not an active member of this business',
      });
    }

    request.membership = { businessId, role: membership.role };
    return true;
  }
}
