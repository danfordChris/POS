import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../src/app.module.js';
import { buildOpenApiDocument, configureApp } from '../src/app.factory.js';

// The OpenAPI document is derived from decorator metadata only. A real database is
// not required; provide a placeholder URL so env validation passes in CI.
process.env.DATABASE_URL ??=
  'postgresql://placeholder:placeholder@localhost:5432/placeholder';
process.env.NODE_ENV ??= 'production';

const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'openapi.json',
);

export async function generateDocument(): Promise<OpenAPIObject> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  const document = buildOpenApiDocument(app);
  await app.close();
  return document;
}

export function serializeDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function outputPath(): string {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  return OUTPUT_PATH;
}
