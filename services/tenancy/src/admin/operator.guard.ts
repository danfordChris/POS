import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Guards `/v1/admin/*`. The route is configured at the edge with
 * `require_business_scope: false`, so an `operator`-audience token passes through
 * with `token_kind: 'operator'`. This guard requires exactly that.
 */
@Injectable()
export class OperatorGuard implements CanActivate {
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
    if (ctx.token_kind !== 'operator' || !ctx.user_id) {
      throw new ForbiddenException({
        code: 'role_forbidden',
        message: 'This route requires an operator account',
      });
    }
    return true;
  }
}
