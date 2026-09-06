import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import {
  buildOpenApiDocument,
  configureApp,
  registerNotFoundFallback,
} from '@pos/nest-common';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  SwaggerModule.setup(
    'v1/docs',
    app,
    buildOpenApiDocument(app, {
      title: 'POS winger service',
      version: '0.1.0',
    }),
  );

  await app.init();
  registerNotFoundFallback(app);

  const port = process.env.WINGER_PORT ?? process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`winger listening on http://localhost:${port}/v1`, 'Bootstrap');
}

bootstrap().catch((error) => {
  Logger.error(error, undefined, 'Bootstrap');
  process.exit(1);
});
