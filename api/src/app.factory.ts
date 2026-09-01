import type { INestApplication } from '@nestjs/common';
import { buildOpenApiDocument as buildDoc } from '@pos/nest-common';

export { configureApp, registerNotFoundFallback } from '@pos/nest-common';

export const API_PREFIX = 'v1';

/** The `api` (monolith) OpenAPI document. Delegates to the shared builder. */
export function buildOpenApiDocument(app: INestApplication) {
  return buildDoc(app, {
    title: 'POS Platform API',
    description: 'Multi-tenant stock management platform API.',
    version: '0.1.0',
  });
}
