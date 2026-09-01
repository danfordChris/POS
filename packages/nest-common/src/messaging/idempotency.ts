/** Inline into a service's first migration. One per service schema. */
export const PROCESSED_EVENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS processed_events (
  event_id uuid PRIMARY KEY,
  subject text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);`;

export interface IdempotencyStore {
  wasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string, subject: string): Promise<void>;
}

export interface IdempotentOutcome<T> {
  skipped: boolean;
  result?: T;
}

/**
 * Runs `fn` at most once per `eventId`. A consumer should call `markProcessed`
 * inside the same transaction as its writes for exactly-once effect; this helper
 * covers the common check → run → mark case.
 */
export async function runIdempotent<T>(
  store: IdempotencyStore,
  eventId: string,
  subject: string,
  fn: () => Promise<T>,
): Promise<IdempotentOutcome<T>> {
  if (await store.wasProcessed(eventId)) {
    return { skipped: true };
  }
  const result = await fn();
  await store.markProcessed(eventId, subject);
  return { skipped: false, result };
}

/** Prisma-backed {@link IdempotencyStore}. `client` search_path is pinned to the service schema. */
export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly client: {
      $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T>;
      $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>;
    },
  ) {}

  async wasProcessed(eventId: string): Promise<boolean> {
    const rows = await this.client.$queryRawUnsafe<{ one: number }[]>(
      `SELECT 1 AS one FROM processed_events WHERE event_id = $1`,
      eventId,
    );
    return rows.length > 0;
  }

  async markProcessed(eventId: string, subject: string): Promise<void> {
    await this.client.$executeRawUnsafe(
      `INSERT INTO processed_events (event_id, subject) VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING`,
      eventId,
      subject,
    );
  }
}
