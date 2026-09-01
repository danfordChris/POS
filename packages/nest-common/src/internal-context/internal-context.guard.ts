import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_CONTEXT_SIGNATURE_HEADER,
  verifyInternalContext,
} from './internal-context.js';
import type { RequestWithContext } from '../http/request-context.js';

/**
 * Rejects any request that does not carry a valid gateway-signed internal
 * context. Downstream services are only reachable via the gateway, so a missing
 * or bad context is a misconfiguration/attack — fail with 500, logged.
 * Attaches `req.internalContext` on success.
 */
@Injectable()
export class InternalContextGuard implements CanActivate {
  private readonly logger = new Logger(InternalContextGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithContext & Request>();
    const secret = this.config.getOrThrow<string>('INTERNAL_CONTEXT_SECRET');

    try {
      const ctx = verifyInternalContext(
        header(request, INTERNAL_CONTEXT_HEADER),
        header(request, INTERNAL_CONTEXT_SIGNATURE_HEADER),
        secret,
      );
      request.internalContext = ctx;
      return true;
    } catch (error) {
      this.logger.error(
        `[${request.requestId ?? 'unknown'}] ${request.method} ${request.originalUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new HttpException(
        { code: 'internal_context_invalid', message: 'Missing or invalid internal context' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
