import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { correlationId } from './common/middleware/correlation-id.middleware.js';
import { ErrorResponse } from './common/http/error-response.js';

export const API_PREFIX = 'v1';

/** Applies every cross-cutting concern. Shared by the runtime bootstrap and the OpenAPI scripts. */
export function configureApp(app: INestApplication): void {
  app.use(correlationId);
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}

/**
 * Terminal handler for routes no controller matched. Registered after the Nest
 * router so genuinely unknown paths return the canonical envelope instead of the
 * platform's default HTML 404.
 */
export function registerNotFoundFallback(app: INestApplication): void {
  const express = app.getHttpAdapter().getInstance();
  express.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        details: [],
      },
      requestId: typeof req.requestId === 'string' ? req.requestId : 'unknown',
    });
  });
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('POS Platform API')
    .setDescription('Multi-tenant stock management platform API.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorResponse],
  });
}
