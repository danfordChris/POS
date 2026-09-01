import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const logger = new Logger('HTTP');

/**
 * Plain Express middleware (bound via `app.use` in app.factory.ts).
 * Assigns a correlation id to every request (honouring an inbound `x-request-id`),
 * echoes it on the response, and logs a one-line access record on completion.
 */
export function correlationId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const inbound = req.headers[REQUEST_ID_HEADER];
  const requestId =
    (Array.isArray(inbound) ? inbound[0] : inbound)?.trim() || randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.log(
      `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`,
    );
  });

  next();
}
