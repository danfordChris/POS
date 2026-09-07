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
  /** Owner contact fields for the notifications projection (additive, v1.1). */
  owner_email: z.string().email().optional(),
  owner_locale: z.string().optional(),
});

export const membershipCreatedPayload = z.object({
  business_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['owner', 'staff']),
  /** Member contact fields for the notifications projection (additive, v1.1). */
  email: z.string().email().optional(),
  locale: z.string().optional(),
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
  /** Business name for the invitation email. Additive (v1.2). */
  business_name: z.string().optional(),
  /** Recipient locale for the invitation email. Additive (v1.2). */
  locale: z.string().optional(),
});

export const invitationAcceptedPayload = z.object({
  business_id: z.string().uuid(),
  invitation_id: z.string().uuid(),
  user_id: z.string().uuid(),
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
  /** Product image URL. Nullable; also fires this event on image change. Additive (v1.2). */
  image_url: z.string().nullable().optional(),
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

export const alertConfigChangedPayload = z.object({
  business_id: z.string().uuid(),
  min_interval_hours: z.number().int().positive(),
  recipients: z.array(z.string()),
});

export const stockFellBelowThresholdPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  on_hand: z.number().int(),
  threshold: z.number().int(),
  /** When this low-stock window opened. Forms the notification dedupe key. */
  opened_at: z.string().datetime(),
  /** Emails / user-ids from `alert_config`; empty ⇒ resolve owners downstream. */
  recipients: z.array(z.string()),
});

export const stockRecoveredPayload = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  on_hand: z.number().int(),
  /** `opened_at` of the window this event closes (matches the open edge). */
  opened_at: z.string().datetime(),
});

export const saleLineRef = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const saleCompletedPayload = z.object({
  business_id: z.string().uuid(),
  sale_id: z.string().uuid(),
  reservation_id: z.string().uuid(),
  lines: z.array(saleLineRef).min(1),
  total: z.number().int(),
  currency: z.string(),
});

export const saleVoidedPayload = z.object({
  business_id: z.string().uuid(),
  sale_id: z.string().uuid(),
  lines: z.array(saleLineRef).min(1),
});

/** Payment method label on an invoice payment. No gateway integration — a note only. */
export const invoicePaymentMethod = z.enum(['cash', 'bank_transfer', 'mobile_money', 'other']);

export const customerCreatedPayload = z.object({
  business_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const customerUpdatedPayload = z.object({
  business_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  disabled: z.boolean(),
});

export const invoiceIssuedPayload = z.object({
  business_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  /** Set when the invoice was issued from a completed sale. */
  sale_id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  /** Absent when the customer has no email on file. */
  customer_email: z.string().email().optional(),
  number: z.number().int().positive(),
  currency: z.string(),
  total_minor: z.number().int().nonnegative(),
  balance_due_minor: z.number().int().nonnegative(),
  issue_date: z.string().datetime(),
  due_date: z.string().datetime(),
  public_token: z.string().min(1),
  locale: z.string(),
});

export const invoicePaymentRecordedPayload = z.object({
  business_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  payment_id: z.string().uuid(),
  amount_minor: z.number().int().positive(),
  method: invoicePaymentMethod,
  balance_due_minor: z.number().int().nonnegative(),
  paid_in_full: z.boolean(),
  customer_email: z.string().email().optional(),
  locale: z.string(),
});

export const invoiceVoidedPayload = z.object({
  business_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  reason: z.string().optional(),
});

export const invoiceDocumentReadyPayload = z.object({
  business_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  /** Object URL in MinIO / S3. */
  url: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().min(1),
});

export const wingerAuthorizedPayload = z.object({
  business_id: z.string().uuid(),
  winger_account_id: z.string().uuid(),
  user_id: z.string().uuid(),
  /** Absolute URL the reseller opens to reach their portal. */
  portal_url: z.string().url(),
  /** Reseller email for the notification. Absent when authorized by phone only. */
  email: z.string().email().optional(),
  locale: z.string(),
});

export const wingerSuspendedPayload = z.object({
  business_id: z.string().uuid(),
  winger_account_id: z.string().uuid(),
});

export const notificationSentPayload = z.object({
  business_id: z.string().uuid(),
  notification_id: z.string().uuid(),
  type: z.string(),
  channel: z.string(),
});

export const notificationFailedPayload = z.object({
  business_id: z.string().uuid(),
  notification_id: z.string().uuid(),
  type: z.string(),
  channel: z.string(),
  error: z.string(),
});

export const EVENT_PAYLOADS = {
  UserRegistered: userRegisteredPayload,
  BusinessCreated: businessCreatedPayload,
  MembershipCreated: membershipCreatedPayload,
  MembershipSuspended: membershipSuspendedPayload,
  InvitationCreated: invitationCreatedPayload,
  InvitationAccepted: invitationAcceptedPayload,
  CategoryUpserted: categoryUpsertedPayload,
  ProductUpserted: productUpsertedPayload,
  PriceChanged: priceChangedPayload,
  ProductDeactivated: productDeactivatedPayload,
  AlertConfigChanged: alertConfigChangedPayload,
  StockMovementRecorded: stockMovementRecordedPayload,
  StockLevelChanged: stockLevelChangedPayload,
  StockFellBelowThreshold: stockFellBelowThresholdPayload,
  StockRecovered: stockRecoveredPayload,
  SaleCompleted: saleCompletedPayload,
  SaleVoided: saleVoidedPayload,
  CustomerCreated: customerCreatedPayload,
  CustomerUpdated: customerUpdatedPayload,
  InvoiceIssued: invoiceIssuedPayload,
  InvoicePaymentRecorded: invoicePaymentRecordedPayload,
  InvoiceVoided: invoiceVoidedPayload,
  InvoiceDocumentReady: invoiceDocumentReadyPayload,
  WingerAuthorized: wingerAuthorizedPayload,
  WingerSuspended: wingerSuspendedPayload,
  NotificationSent: notificationSentPayload,
  NotificationFailed: notificationFailedPayload,
} as const;
