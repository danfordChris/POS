import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { RequestWithContext } from './request-context.js';

export const REQUEST_ID_HEADER = 'x-request-id';

const logger = new Logger('HTTP');

/**
 * Plain Express middleware (bound via `app.use` by `configureApp()`).
 * Assigns a correlation id to every request (honouring an inbound `x-request-id`),
 * echoes it on the response, and logs one structured access record on completion
 * carrying `request_id`, `method`, `path`, `status`, `duration_ms`, and
 * `business_id` when the request resolved a signed internal context.
 */
export function correlationId(req: RequestWithContext, res: Response, next: NextFunction): void {
  const inbound = req.headers[REQUEST_ID_HEADER];
  const requestId = (Array.isArray(inbound) ? inbound[0] : inbound)?.trim() || randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    // `internalContext` is attached by InternalContextGuard, which has run by
    // the time the response finishes.
    const businessId = req.internalContext?.business_id ?? undefined;
    const record: Record<string, unknown> = {
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(1)),
    };
    if (businessId) record.business_id = businessId;
    logger.log(JSON.stringify(record));
  });

  next();
}
