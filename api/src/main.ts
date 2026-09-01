import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import {
  API_PREFIX,
  buildOpenApiDocument,
  configureApp,
  registerNotFoundFallback,
} from './app.factory.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app));

  // Mount controller routes, then register the not-found fallback strictly last.
  await app.init();
  registerNotFoundFallback(app);

  const port = process.env.API_PORT ?? process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(
    `API listening on http://localhost:${port}/${API_PREFIX}`,
    'Bootstrap',
  );
}

bootstrap().catch((error) => {
  Logger.error(error, undefined, 'Bootstrap');
  process.exit(1);
});
