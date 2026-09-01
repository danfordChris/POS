import { DynamicModule, FactoryProvider, Module } from '@nestjs/common';
import type { MessageBus } from '@pos/contracts';
import { NatsCoreBus } from './nats.adapter.js';

export const MESSAGE_BUS = Symbol('MESSAGE_BUS');

export interface NatsModuleOptions {
  url: string;
  name?: string;
}

/**
 * Provides `MESSAGE_BUS` (a {@link MessageBus}).
 * - `forRoot` / `forRootAsync` connect a real {@link NatsCoreBus}.
 * - `forTest` injects a supplied bus (the in-memory double from `@pos/testing`).
 */
@Module({})
export class NatsModule {
  static forRoot(options: NatsModuleOptions): DynamicModule {
    return NatsModule.forRootAsync({ useFactory: () => options });
  }

  static forRootAsync(config: {
    imports?: DynamicModule['imports'];
    inject?: FactoryProvider['inject'];
    useFactory: (...args: any[]) => NatsModuleOptions | Promise<NatsModuleOptions>;
  }): DynamicModule {
    const provider: FactoryProvider = {
      provide: MESSAGE_BUS,
      inject: config.inject ?? [],
      useFactory: async (...args: unknown[]) => {
        const options = await config.useFactory(...args);
        return NatsCoreBus.connect(options.url, options.name);
      },
    };
    return {
      module: NatsModule,
      imports: config.imports ?? [],
      providers: [provider],
      exports: [MESSAGE_BUS],
      global: true,
    };
  }

  static forTest(bus: MessageBus): DynamicModule {
    return {
      module: NatsModule,
      providers: [{ provide: MESSAGE_BUS, useValue: bus }],
      exports: [MESSAGE_BUS],
      global: true,
    };
  }
}
