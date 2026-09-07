-- Payments accept an Idempotency-Key; a replay must not record a second payment.
ALTER TABLE "payment" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "payment_business_id_idempotency_key_key"
  ON "payment" ("business_id", "idempotency_key");
