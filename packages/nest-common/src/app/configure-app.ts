import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from '../http/all-exceptions.filter.js';
import { correlationId } from '../http/correlation-id.middleware.js';

export interface ConfigureAppOptions {
  /** URL prefix for all routes. Default `v1`. Pass `''` to disable. */
  prefix?: string;
}

/**
 * Applies every cross-cutting HTTP concern: correlation id, global prefix,
 * strict validation pipe, canonical error filter, shutdown hooks.
 * Shared by the runtime bootstrap and the OpenAPI generation scripts.
 */
export function configureApp(app: INestApplication, options: ConfigureAppOptions = {}): void {
  const prefix = options.prefix ?? 'v1';

  app.use(correlationId);
  if (prefix) {
    app.setGlobalPrefix(prefix);
  }
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
