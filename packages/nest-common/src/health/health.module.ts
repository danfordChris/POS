import {
  Controller,
  DynamicModule,
  Get,
  HttpStatus,
  Inject,
  Injectable,
  Module,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

export interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
}

export interface HealthModuleOptions {
  serviceName: string;
  checks?: HealthCheck[];
}

export const HEALTH_OPTIONS = Symbol('HEALTH_OPTIONS');

@Injectable()
class HealthService {
  constructor(@Inject(HEALTH_OPTIONS) private readonly options: HealthModuleOptions) {}

  async run(): Promise<{ name: string; ok: boolean }[]> {
    return Promise.all(
      (this.options.checks ?? []).map(async (c) => {
        try {
          return { name: c.name, ok: await c.check() };
        } catch {
          return { name: c.name, ok: false };
        }
      }),
    );
  }
}

@Controller()
class HealthController {
  constructor(
    @Inject(HEALTH_OPTIONS) private readonly options: HealthModuleOptions,
    private readonly service: HealthService,
  ) {}

  /** Liveness: the process is up. Never touches dependencies. */
  @Get('healthz')
  live(): { status: 'ok'; service: string } {
    return { status: 'ok', service: this.options.serviceName };
  }

  /** Readiness: every dependency check passes. */
  @Get('readyz')
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks = await this.service.run();
    const ok = checks.every((c) => c.ok);
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'degraded', service: this.options.serviceName, checks };
  }
}

/**
 * `GET /healthz` (liveness) + `GET /readyz` (readiness). Keep these off the URL
 * prefix via `configureApp`'s default `excludePrefixPaths`.
 */
@Module({})
export class HealthModule {
  static forRoot(options: HealthModuleOptions): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [{ provide: HEALTH_OPTIONS, useValue: options }, HealthService],
    };
  }

  static forRootAsync(config: {
    imports?: DynamicModule['imports'];
    inject?: unknown[];
    useFactory: (...args: any[]) => HealthModuleOptions | Promise<HealthModuleOptions>;
  }): DynamicModule {
    return {
      module: HealthModule,
      imports: config.imports ?? [],
      controllers: [HealthController],
      providers: [
        {
          provide: HEALTH_OPTIONS,
          inject: (config.inject ?? []) as never[],
          useFactory: config.useFactory,
        },
        HealthService,
      ],
    };
  }
}
