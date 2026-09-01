import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards every `/v1/businesses/:businessId/*` route. Resolves the tenant from the
 * PATH (never the body/headers), verifies the caller is an active member, and
 * attaches `req.user` + `req.membership`. Operator tokens are refused outright.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Missing bearer token',
      });
    }

    let claims: { sub?: string; aud?: string | string[]; typ?: string };
    try {
      claims = this.tokens.verifyAccessToken(
        header.slice('Bearer '.length).trim(),
      );
    } catch {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Invalid or expired token',
      });
    }

    const audience = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud;
    if (audience === 'operator') {
      throw new ForbiddenException({
        code: 'operator_data_access_denied',
        message: 'Operators cannot access tenant data',
      });
    }
    if (audience !== 'user' || claims.typ !== 'access' || !claims.sub) {
      throw new UnauthorizedException({
        code: 'wrong_token_audience',
        message: "Token audience is not 'user'",
      });
    }

    const rawBusinessId = request.params.businessId;
    const businessId = typeof rawBusinessId === 'string' ? rawBusinessId : '';
    if (!businessId || !UUID_RE.test(businessId)) {
      throw new UnauthorizedException({
        code: 'not_a_member',
        message: 'Unknown business',
      });
    }

    const membership = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.membership.findUnique({
        where: {
          businessId_userId: { businessId, userId: claims.sub as string },
        },
      }),
    );

    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'Not an active member of this business',
      });
    }

    request.user = { id: claims.sub };
    request.membership = { businessId, role: membership.role };
    return true;
  }
}
