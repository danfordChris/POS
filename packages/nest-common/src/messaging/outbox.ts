import { Logger } from '@nestjs/common';
import type { MessageBus } from '@pos/contracts';

/** Inline this into a service's first migration. One outbox table per service schema. */
export const OUTBOX_TABLE_SQL = `CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  subject text NOT NULL,
  payload jsonb NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);
CREATE INDEX IF NOT EXISTS outbox_unsent_idx ON outbox (created_at) WHERE sent_at IS NULL;`;

export interface OutboxRow {
  id: string;
  subject: string;
  payload: unknown;
  headers: Record<string, string>;
  attempts: number;
}

export interface OutboxStore {
  fetchUnsent(limit: number): Promise<OutboxRow[]>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

/** Minimal shape of a Prisma transaction client that can run parameterised SQL. */
export interface SqlExecutor {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

export interface OutboxEntry {
  subject: string;
  payload: unknown;
  headers?: Record<string, string>;
}

/**
 * Writes a message to the `outbox` table using the CALLER'S transaction, so the
 * domain write and the intent-to-publish commit or roll back together.
 */
export class OutboxWriter {
  async write(tx: SqlExecutor, entry: OutboxEntry): Promise<void> {
    const payload = JSON.stringify(entry.payload);
    const headers = JSON.stringify(entry.headers ?? {});
    await tx.$executeRaw`INSERT INTO outbox (subject, payload, headers) VALUES (${entry.subject}, ${payload}::jsonb, ${headers}::jsonb)`;
  }
}

export interface OutboxRelayOptions {
  batchSize?: number;
  pollMs?: number;
  /** Rows past this many failed attempts are logged as stuck (still retried). */
  warnAfterAttempts?: number;
}

/**
 * Polls the outbox and publishes unsent rows to the bus (at-least-once).
 * Publish-then-mark: a crash between the two re-publishes the row on restart,
 * which idempotent consumers absorb.
 */
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;

  constructor(
    private readonly store: OutboxStore,
    private readonly bus: MessageBus,
    private readonly options: OutboxRelayOptions = {},
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.pollMs ?? 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Publish one batch. Returns the number of rows published. Safe to call concurrently (guarded). */
  async tick(): Promise<number> {
    if (this.ticking) return 0;
    this.ticking = true;
    try {
      const rows = await this.store.fetchUnsent(this.options.batchSize ?? 50);
      let published = 0;
      for (const row of rows) {
        try {
          await this.bus.publish(row.subject, row.payload, {
            headers: row.headers,
            msgId: row.id,
          });
          await this.store.markSent(row.id);
          published += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.store.markFailed(row.id, message);
          if (row.attempts + 1 >= (this.options.warnAfterAttempts ?? 5)) {
            this.logger.warn(
              `outbox row ${row.id} stuck after ${row.attempts + 1} attempts: ${message}`,
            );
          }
        }
      }
      return published;
    } finally {
      this.ticking = false;
    }
  }
}

/** Prisma-backed {@link OutboxStore}. `client` must have its search_path pinned to the service schema. */
export class PrismaOutboxStore implements OutboxStore {
  constructor(
    private readonly client: {
      $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T>;
      $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>;
    },
  ) {}

  async fetchUnsent(limit: number): Promise<OutboxRow[]> {
    const rows = await this.client.$queryRawUnsafe<
      {
        id: string;
        subject: string;
        payload: unknown;
        headers: Record<string, string>;
        attempts: number;
      }[]
    >(
      `SELECT id, subject, payload, headers, attempts FROM outbox
       WHERE sent_at IS NULL ORDER BY created_at LIMIT $1`,
      limit,
    );
    return rows;
  }

  async markSent(id: string): Promise<void> {
    await this.client.$executeRawUnsafe(`UPDATE outbox SET sent_at = now() WHERE id = $1`, id);
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.client.$executeRawUnsafe(
      `UPDATE outbox SET attempts = attempts + 1, last_error = $2 WHERE id = $1`,
      id,
      error,
    );
  }
}
