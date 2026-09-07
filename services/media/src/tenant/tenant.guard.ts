import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards `/v1/businesses/:businessId/*` in a service that does NOT own the
 * membership table. The edge (Kong `pos-internal-context`) has already resolved
 * and required an active membership and signed the result; `InternalContextGuard`
 * verified that signature upstream. This guard enforces the invariants that
 * remain: reject operator callers, require a `user` context with a role, and
 * reject a context whose `business_id` does not match the path. It attaches
 * `req.membership` for `RolesGuard` and downstream tenant scoping.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
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
    if (!ctx.business_id || ctx.business_id !== businessId) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'Internal context does not match the requested business',
        userMessage: 'You do not have access to this business.',
      });
    }
    if (!ctx.role) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'Internal context carries no membership role',
        userMessage: 'You do not have access to this business.',
      });
    }

    request.membership = { businessId, role: ctx.role };
    return true;
  }
}
