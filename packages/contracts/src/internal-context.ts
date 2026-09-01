import { z } from 'zod';

/**
 * Signed context the gateway forwards to every downstream service. Services trust
 * it on the private network and reject any request without a valid one.
 */
export const internalContextSchema = z.object({
  request_id: z.string().min(1),
  user_id: z.string().uuid().nullable(),
  business_id: z.string().uuid().nullable(),
  role: z.enum(['owner', 'staff', 'winger']).nullable(),
  token_kind: z.enum(['user', 'operator', 'system']),
  issued_at: z.number().int(),
  expires_at: z.number().int(),
});

export type InternalContext = z.infer<typeof internalContextSchema>;

export const INTERNAL_CONTEXT_HEADER = 'x-pos-internal-context';
export const INTERNAL_CONTEXT_SIGNATURE_HEADER = 'x-pos-internal-signature';
