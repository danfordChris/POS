import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
  });

  it('reports status ok for the api service', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
