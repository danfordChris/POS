export interface OutboxRow {
  id: string;
  subject: string;
  payload: unknown;
  headers: Record<string, string>;
  attempts: number;
}

let seq = 0;

/** In-memory implementation of the outbox store used by `OutboxRelay` tests. */
export class InMemoryOutboxStore {
  readonly rows: (OutboxRow & { sentAt: number | null; lastError: string | null })[] = [];

  /** Simulate the domain transaction's INSERT into `outbox`. */
  append(entry: { subject: string; payload: unknown; headers?: Record<string, string> }): string {
    const id = `ob-${(seq += 1)}`;
    this.rows.push({
      id,
      subject: entry.subject,
      payload: entry.payload,
      headers: entry.headers ?? {},
      attempts: 0,
      sentAt: null,
      lastError: null,
    });
    return id;
  }

  async fetchUnsent(limit: number): Promise<OutboxRow[]> {
    return this.rows
      .filter((r) => r.sentAt === null)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        subject: r.subject,
        payload: r.payload,
        headers: r.headers,
        attempts: r.attempts,
      }));
  }

  async markSent(id: string): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.sentAt = Date.now();
  }

  async markFailed(id: string, error: string): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.attempts += 1;
      row.lastError = error;
    }
  }
}

/** In-memory implementation of the idempotency store. */
export class InMemoryIdempotencyStore {
  private readonly seen = new Map<string, string>();

  async wasProcessed(eventId: string): Promise<boolean> {
    return this.seen.has(eventId);
  }

  async markProcessed(eventId: string, subject: string): Promise<void> {
    this.seen.set(eventId, subject);
  }

  get size(): number {
    return this.seen.size;
  }
}
