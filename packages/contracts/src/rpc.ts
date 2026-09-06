import { z } from 'zod';

/** Synchronous request/reply payloads. Request/response pairs per subject. */

export const getUserRequest = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  /**
   * When true and an `email`/`phone` matches no user, identity provisions a
   * passwordless shell user and returns it (`found: true`). Used by the winger
   * service when an Owner authorizes a reseller who has not registered yet.
   */
  create: z.boolean().optional(),
});
export const getUserResponse = z.union([
  z.object({
    found: z.literal(true),
    user_id: z.string().uuid(),
    name: z.string(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    disabled: z.boolean(),
    /** BCP-47 locale for outbound notifications. Additive (v1.2). */
    locale: z.string().optional(),
  }),
  z.object({ found: z.literal(false) }),
]);

export const verifyTokenRequest = z.object({ access_token: z.string().min(1) });
export const verifyTokenResponse = z.union([
  z.object({
    valid: z.literal(true),
    sub: z.string(),
    aud: z.enum(['user', 'operator']),
    typ: z.literal('access'),
  }),
  z.object({ valid: z.literal(false) }),
]);

export const resolveMembershipRequest = z.object({
  business_id: z.string().uuid(),
  user_id: z.string().uuid(),
});
export const resolveMembershipResponse = z.object({
  found: z.boolean(),
  role: z.enum(['owner', 'staff']).nullable(),
  status: z.enum(['active', 'suspended']).nullable(),
});

export const reserveStockRequest = z.object({
  business_id: z.string().uuid(),
  reservation_id: z.string().uuid(),
  lines: z.array(
    z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() }),
  ),
});
export const reserveStockResponse = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    shortfalls: z.array(z.object({ product_id: z.string().uuid(), available: z.number().int() })),
  }),
]);

export const commitReservationRequest = z.object({
  business_id: z.string().uuid(),
  reservation_id: z.string().uuid(),
  sale_id: z.string().uuid(),
});
export const commitReservationResponse = z.object({ ok: z.boolean() });

export const releaseReservationRequest = z.object({
  business_id: z.string().uuid(),
  reservation_id: z.string().uuid(),
});
export const releaseReservationResponse = z.object({ ok: z.boolean() });
