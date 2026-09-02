import { z } from 'zod';

/** Domain event payloads (inside `messageEnvelopeSchema.payload`). Additive changes only. */

export const userRegisteredPayload = z.object({
  user_id: z.string().uuid(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
});

export const businessCreatedPayload = z.object({
  business_id: z.string().uuid(),
  name: z.string(),
  currency: z.string(),
  locale: z.string(),
  owner_user_id: z.string().uuid(),
});

export const membershipCreatedPayload = z.object({
  business_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['owner', 'staff']),
});

export const membershipSuspendedPayload = z.object({
  business_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export const invitationCreatedPayload = z.object({
  business_id: z.string().uuid(),
  invitation_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['staff']),
  accept_url: z.string().url(),
  expires_at: z.string().datetime(),
});

export const categoryUpsertedPayload = z.object({
  business_id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
});

export const productUpsertedPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  unit: z.string(),
  is_active: z.boolean(),
  reorder_threshold: z.number().int().nonnegative(),
});

export const priceChangedPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  sell_price: z.number().int(),
  winger_price: z.number().int().nullable(),
  currency: z.string(),
});

export const productDeactivatedPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
});

export const stockMovementType = z.enum([
  'stock_in',
  'adjustment',
  'sale',
  'return',
  'void_reversal',
]);

export const stockMovementRecordedPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  movement_id: z.string().uuid(),
  type: stockMovementType,
  quantity_delta: z.number().int(),
});

export const stockLevelChangedPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  on_hand: z.number().int(),
});

export const stockFellBelowThresholdPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  on_hand: z.number().int(),
  threshold: z.number().int(),
});

export const stockRecoveredPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  on_hand: z.number().int(),
});

export const EVENT_PAYLOADS = {
  UserRegistered: userRegisteredPayload,
  BusinessCreated: businessCreatedPayload,
  MembershipCreated: membershipCreatedPayload,
  MembershipSuspended: membershipSuspendedPayload,
  InvitationCreated: invitationCreatedPayload,
  CategoryUpserted: categoryUpsertedPayload,
  ProductUpserted: productUpsertedPayload,
  PriceChanged: priceChangedPayload,
  ProductDeactivated: productDeactivatedPayload,
  StockMovementRecorded: stockMovementRecordedPayload,
  StockLevelChanged: stockLevelChangedPayload,
  StockFellBelowThreshold: stockFellBelowThresholdPayload,
  StockRecovered: stockRecoveredPayload,
} as const;
