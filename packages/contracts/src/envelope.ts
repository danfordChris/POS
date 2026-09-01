import { z } from 'zod';

/** Common envelope wrapped around every event and RPC payload. */
export const messageEnvelopeSchema = z.object({
  event_id: z.string().uuid(),
  occurred_at: z.string().datetime(),
  business_id: z.string().uuid().nullable(),
  producer: z.string().min(1),
  schema_version: z.string().min(1),
});

export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>;

export function withEnvelope<T extends z.ZodTypeAny>(payload: T) {
  return messageEnvelopeSchema.extend({ payload });
}
