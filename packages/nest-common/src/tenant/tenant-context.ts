import { AsyncLocalStorage } from 'node:async_hooks';

export class TenantContextError extends Error {
  constructor(detail: string) {
    super(`No tenant context bound: ${detail}. Wrap the call in runInTenantContext().`);
    this.name = 'TenantContextError';
  }
}

interface TxLike {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

export interface TenantCapableClient {
  $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}

/**
 * Layer 3 of the isolation model (docs/design/architecture/multi-tenancy.md):
 * binds an `AsyncLocalStorage` tenant context and, inside a transaction, sets the
 * `app.business_id` GUC so PostgreSQL RLS scopes every statement.
 *
 * A service's `PrismaService` composes one of these and delegates
 * `runInTenantContext` / `currentBusinessId` / `assertTenantContext` to it.
 */
export class TenantContext {
  private readonly store = new AsyncLocalStorage<{ businessId: string }>();

  currentBusinessId(): string | undefined {
    return this.store.getStore()?.businessId;
  }

  assert(detail = 'tenant model access'): void {
    if (!this.store.getStore()) {
      throw new TenantContextError(detail);
    }
  }

  async run<T>(
    client: TenantCapableClient,
    businessId: string,
    fn: (tx: unknown) => Promise<T>,
  ): Promise<T> {
    return this.store.run({ businessId }, () =>
      client.$transaction(async (tx) => {
        try {
          await (tx as TxLike)
            .$executeRaw`SELECT set_config('app.business_id', ${businessId}, true)`;
        } catch (error) {
          throw new Error(
            `Failed to bind tenant context: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return fn(tx);
      }),
    );
  }
}
