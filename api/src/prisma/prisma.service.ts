import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

export class TenantContextError extends Error {
  constructor(detail: string) {
    super(
      `No tenant context bound: ${detail}. Wrap the call in runInTenantContext().`,
    );
    this.name = 'TenantContextError';
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly tenantStore = new AsyncLocalStorage<{
    businessId: string;
  }>();

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error(
        `Database connection failed at startup: ${asMessage(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } catch (error) {
      this.logger.error(
        `Error during database disconnect: ${asMessage(error)}`,
      );
    }
  }

  async pingDatabase(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(`Database ping failed: ${asMessage(error)}`);
      return false;
    }
  }

  /** The business id bound to the current async context, if any. */
  currentBusinessId(): string | undefined {
    return this.tenantStore.getStore()?.businessId;
  }

  /** Throws unless a tenant context is bound. For repositories that touch tenant models. */
  assertTenantContext(detail = 'tenant model access'): void {
    if (!this.tenantStore.getStore()) {
      throw new TenantContextError(detail);
    }
  }

  /**
   * Runs `fn` inside a transaction with `app.business_id` set (LOCAL to the
   * transaction) so PostgreSQL RLS scopes every statement to that tenant.
   * Layer 3 of the isolation model in docs/design/architecture/multi-tenancy.md.
   */
  async runInTenantContext<T>(
    businessId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.tenantStore.run({ businessId }, () =>
      this.$transaction(async (tx) => {
        try {
          await tx.$executeRaw`SELECT set_config('app.business_id', ${businessId}, true)`;
        } catch (error) {
          throw new Error(`Failed to bind tenant context: ${asMessage(error)}`);
        }
        return fn(tx);
      }),
    );
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
