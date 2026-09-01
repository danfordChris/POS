import { randomUUID } from 'node:crypto';
import { makeEnvelope } from '@pos/contracts';

export const uuid = (): string => randomUUID();

/** A ready-to-publish message envelope for tests. */
export function envelopeFixture(
  overrides: {
    producer?: string;
    businessId?: string | null;
    payload?: unknown;
    eventId?: string;
  } = {},
) {
  return makeEnvelope({
    producer: overrides.producer ?? 'test',
    businessId: overrides.businessId ?? null,
    schemaVersion: '1.0.0',
    payload: overrides.payload ?? { hello: 'world' },
    eventId: overrides.eventId,
  });
}

/**
 * Fake `tx.$executeRaw` that records the parameter values `OutboxWriter` passes,
 * so a test can assert what would have been inserted and commit/rollback it.
 */
export function makeFakeTx() {
  const staged: { subject: string; payload: unknown; headers: Record<string, string> }[] = [];
  const tx = {
    // OutboxWriter calls: INSERT ... VALUES (${subject}, ${payload}::jsonb, ${headers}::jsonb)
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]): Promise<number> => {
      staged.push({
        subject: String(values[0]),
        payload: JSON.parse(String(values[1])),
        headers: JSON.parse(String(values[2])),
      });
      return 1;
    },
  };
  return { tx, staged };
}
