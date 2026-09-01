import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp, registerNotFoundFallback } from '../src/app.factory.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function bootstrap(dbReachable: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
      pingDatabase: async () => dbReachable,
      onModuleInit: async () => undefined,
      onModuleDestroy: async () => undefined,
    })
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);
  return app;
}

describe('GET /v1/health (e2e)', () => {
  it('returns 200 and db:up when the database is reachable', async () => {
    const app = await bootstrap(true);
    try {
      const res = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        service: 'api',
        db: 'up',
      });
      expect(typeof res.body.timestamp).toBe('string');
      expect(res.headers['x-request-id']).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('returns 503 and db:down when the database is unreachable', async () => {
    const app = await bootstrap(false);
    try {
      const res = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(503);
      expect(res.body).toMatchObject({
        status: 'error',
        service: 'api',
        db: 'down',
      });
    } finally {
      await app.close();
    }
  });

  it('returns the canonical error envelope for an unknown route', async () => {
    const app = await bootstrap(true);
    try {
      const res = await request(app.getHttpServer())
        .get('/v1/does-not-exist')
        .expect(404);
      expect(res.body).toMatchObject({
        error: { code: 'not_found', details: [] },
      });
      expect(res.headers['content-type']).toContain('application/json');
    } finally {
      await app.close();
    }
  });
});
