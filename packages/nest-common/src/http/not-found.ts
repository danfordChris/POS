import type { INestApplication } from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithContext } from './request-context.js';

/**
 * Terminal handler for routes no controller matched. Register it after the Nest
 * router (post `app.init()`) so unknown paths return the canonical envelope
 * instead of the platform's default HTML 404.
 */
export function registerNotFoundFallback(app: INestApplication): void {
  const express = app.getHttpAdapter().getInstance();
  express.use((req: RequestWithContext, res: Response) => {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: 'We could not find what you were looking for.',
        devMessage: `No route for ${req.method} ${req.originalUrl}`,
        details: [],
      },
      requestId: typeof req.requestId === 'string' ? req.requestId : 'unknown',
    });
  });
}
