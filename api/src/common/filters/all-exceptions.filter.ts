import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ErrorDetail,
  ErrorResponse,
  INTERNAL_ERROR_CODE,
  STATUS_CODE_MAP,
  VALIDATION_ERROR_CODE,
} from '../http/error-response.js';

/**
 * Converts every thrown error into the canonical envelope:
 * `{ error: { code, message, details }, requestId }`.
 * Registered globally in app.factory.ts so no handler leaks a raw error or stack.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      typeof request?.requestId === 'string' ? request.requestId : 'unknown';

    const { status, body } = this.normalize(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request?.method} ${request?.originalUrl} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload: ErrorResponse = { error: body, requestId };
    response.status(status).json(payload);
  }

  private normalize(exception: unknown): {
    status: number;
    body: ErrorResponse['error'];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      const rawMessages: string[] = this.extractMessages(res);
      const isValidation =
        status === HttpStatus.BAD_REQUEST &&
        Array.isArray((res as { message?: unknown })?.message);

      if (isValidation) {
        return {
          status,
          body: {
            code: VALIDATION_ERROR_CODE,
            message: 'Validation failed',
            details: rawMessages.map(toDetail),
          },
        };
      }

      return {
        status,
        body: {
          code: STATUS_CODE_MAP[status] ?? INTERNAL_ERROR_CODE,
          message: rawMessages[0] ?? exception.message,
          details: [],
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: INTERNAL_ERROR_CODE,
        message: 'Internal server error',
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
}

function toDetail(message: string): ErrorDetail {
  // class-validator messages conventionally start with the offending property name.
  const field = message.split(' ')[0] ?? '';
  return { field, issue: message };
}
