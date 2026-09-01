// Builds the OpenAPI document from the COMPILED app in dist/. Run `nest build` first.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { buildOpenApiDocument, configureApp } from '../dist/app.factory.js';

// The document is derived from decorator metadata only; a real database is not
// needed. Provide placeholders so env validation passes in CI.
process.env.DATABASE_URL ??=
  'postgresql://placeholder:placeholder@localhost:5432/placeholder';
process.env.JWT_ACCESS_SECRET ??= 'placeholder-openapi-secret-value';
process.env.NODE_ENV ??= 'production';

const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'openapi.json',
);

export async function generateDocument() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  const document = buildOpenApiDocument(app);
  await app.close();
  return document;
}

export function serializeDocument(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function outputPath() {
  return OUTPUT_PATH;
}
