import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  SUBJECT_OPERATOR,
  SUBJECT_USER,
  SubjectType,
} from '../auth.constants.js';
import { TokenService } from '../token.service.js';

/**
 * Base bearer-token guard. Subclasses fix the expected audience. A token whose
 * signature/expiry is invalid → 401 `unauthenticated`; a valid token for the
 * wrong audience → 401 `wrong_token_audience`.
 */
abstract class JwtAuthGuard implements CanActivate {
  protected abstract readonly audience: SubjectType;

  protected constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Missing bearer token',
      });
    }

    const raw = header.slice('Bearer '.length).trim();

    let claims: { sub?: string; aud?: string | string[]; typ?: string };
    try {
      claims = this.tokens.verifyAccessToken(raw);
    } catch {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Invalid or expired token',
      });
    }

    const audience = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud;
    if (claims.typ !== 'access' || audience !== this.audience) {
      throw new UnauthorizedException({
        code: 'wrong_token_audience',
        message: `Token audience is not '${this.audience}'`,
      });
    }

    if (!claims.sub) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Token has no subject',
      });
    }

    if (this.audience === SUBJECT_USER) {
      request.user = { id: claims.sub };
    } else {
      request.operator = { id: claims.sub };
    }
    return true;
  }
}

@Injectable()
export class UserAuthGuard extends JwtAuthGuard {
  protected readonly audience = SUBJECT_USER;

  // Explicit constructor so Nest DI sees this subclass's own parameter metadata.
  constructor(tokens: TokenService) {
    super(tokens);
  }
}

@Injectable()
export class OperatorAuthGuard extends JwtAuthGuard {
  protected readonly audience = SUBJECT_OPERATOR;

  constructor(tokens: TokenService) {
    super(tokens);
  }
}
