import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { MESSAGE_BUS, OutboxRelay, PrismaOutboxStore } from '@pos/nest-common';
import type { MessageBus } from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

/** Runs the outbox relay for the lifetime of the process. */
@Injectable()
export class OutboxRelayService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly relay: OutboxRelay;

  constructor(prisma: PrismaService, @Inject(MESSAGE_BUS) bus: MessageBus) {
    this.relay = new OutboxRelay(new PrismaOutboxStore(prisma), bus, {
      pollMs: 1000,
    });
  }

  onApplicationBootstrap(): void {
    // Tests drive the relay with tick(); production runs it on a timer.
    if (process.env.NODE_ENV === 'test') return;
    this.relay.start();
    this.logger.log('outbox relay started');
  }

  onModuleDestroy(): void {
    this.relay.stop();
  }

  /** Exposed for tests: publish one batch now. */
  tick(): Promise<number> {
    return this.relay.tick();
  }
}
