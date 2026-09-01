import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  TenantContext,
  TenantContextError,
  type TenantCapableClient,
} from '@pos/nest-common';

export { TenantContextError };

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly tenant = new TenantContext();

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

  currentBusinessId(): string | undefined {
    return this.tenant.currentBusinessId();
  }

  assertTenantContext(detail = 'tenant model access'): void {
    this.tenant.assert(detail);
  }

  async runInTenantContext<T>(
    businessId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.tenant.run(
      this as unknown as TenantCapableClient,
      businessId,
      (tx) => fn(tx as Prisma.TransactionClient),
    );
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
