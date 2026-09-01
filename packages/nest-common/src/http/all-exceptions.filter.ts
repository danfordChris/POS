import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ErrorDetail,
  ErrorResponse,
  INTERNAL_ERROR_CODE,
  STATUS_CODE_MAP,
  VALIDATION_ERROR_CODE,
  friendlyFor,
} from './error-response.js';
import type { RequestWithContext } from './request-context.js';

/**
 * Converts every thrown error into the canonical envelope:
 * `{ error: { code, message, devMessage, details }, requestId }`.
 * - `message` is user-friendly (safe to show end-users).
 * - `devMessage` is the technical detail (no stack traces, no secrets).
 * Registered globally by `configureApp()` so no handler leaks a raw error.
 *
 * Handlers throw `new HttpException({ code, message?, userMessage?, details? }, status)`:
 * `message` (or the plain string) becomes `devMessage`; `userMessage` — or the
 * friendly copy for `code` — becomes `message`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();
    const requestId = typeof request?.requestId === 'string' ? request.requestId : 'unknown';

    const { status, body } = this.normalize(exception, requestId);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request?.method} ${request?.originalUrl} -> ${status}: ${body.devMessage}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload: ErrorResponse = { error: body, requestId };
    response.status(status).json(payload);
  }

  private normalize(
    exception: unknown,
    requestId: string,
  ): { status: number; body: ErrorResponse['error'] } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      const rawMessages = this.extractMessages(res);
      const isValidation =
        status === HttpStatus.BAD_REQUEST && Array.isArray((res as { message?: unknown })?.message);

      if (isValidation) {
        return {
          status,
          body: {
            code: VALIDATION_ERROR_CODE,
            message: friendlyFor(VALIDATION_ERROR_CODE, 'Validation failed.'),
            devMessage: rawMessages.join('; ') || 'Validation failed',
            details: rawMessages.map(toDetail),
          },
        };
      }

      const code = this.readString(res, 'code') ?? STATUS_CODE_MAP[status] ?? INTERNAL_ERROR_CODE;
      const devMessage = rawMessages[0] ?? exception.message;
      const userMessage = this.readString(res, 'userMessage') ?? friendlyFor(code, devMessage);

      return {
        status,
        body: {
          code,
          message: userMessage,
          devMessage,
          details: this.readDetails(res),
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: INTERNAL_ERROR_CODE,
        message: friendlyFor(INTERNAL_ERROR_CODE, 'Something went wrong.'),
        devMessage: `Unhandled server error. Reference: ${requestId}. See server logs.`,
        details: [],
      },
    };
  }

  private extractMessages(res: unknown): string[] {
    if (typeof res === 'string') return [res];
    if (res && typeof res === 'object' && 'message' in res) {
      const message = (res as { message: unknown }).message;
      if (Array.isArray(message)) return message.map(String);
      if (typeof message === 'string') return [message];
    }
    return [];
  }

  private readString(res: unknown, key: string): string | undefined {
    if (res && typeof res === 'object' && key in res) {
      const value = (res as Record<string, unknown>)[key];
      if (typeof value === 'string') return value;
    }
    return undefined;
  }

  private readDetails(res: unknown): ErrorDetail[] {
    if (res && typeof res === 'object' && Array.isArray((res as { details?: unknown }).details)) {
      return (res as { details: ErrorDetail[] }).details;
    }
    return [];
  }
}

function toDetail(message: string): ErrorDetail {
  const field = message.split(' ')[0] ?? '';
  return { field, issue: message };
}
