-- Per-business digest cadence, projected from inventory's AlertConfigChanged.
-- Internal worker config: no RLS.
CREATE TABLE "digest_config" (
    "business_id" UUID NOT NULL,
    "min_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_config_pkey" PRIMARY KEY ("business_id")
);
