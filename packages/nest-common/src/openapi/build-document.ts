import type { INestApplication, Type } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ErrorResponse } from '../http/error-response.js';

export interface OpenApiOptions {
  title: string;
  description?: string;
  version?: string;
  bearerAuth?: boolean;
  extraModels?: Type<unknown>[];
}

export function buildOpenApiDocument(
  app: INestApplication,
  options: OpenApiOptions,
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description ?? '')
    .setVersion(options.version ?? '0.1.0');

  if (options.bearerAuth ?? true) {
    builder.addBearerAuth();
  }

  return SwaggerModule.createDocument(app, builder.build(), {
    extraModels: [ErrorResponse, ...(options.extraModels ?? [])],
  });
}
