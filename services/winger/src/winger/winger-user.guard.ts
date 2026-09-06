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
 * Guards `/v1/winger/*`. The edge forwards a signed user context but resolves no
 * membership (these routes are not business-scoped at Kong). This guard only
 * asserts a real user identity; per-business authorization against
 * `winger_account` happens in `WingerCatalogService`.
 */
@Injectable()
export class WingerUserGuard implements CanActivate {
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
        message: 'Operators cannot access winger data',
      });
    }
    if (ctx.token_kind !== 'user' || !ctx.user_id) {
      throw new ForbiddenException({
        code: 'winger_scope_denied',
        message: 'Not authorized as a winger',
      });
    }
    return true;
  }
}
