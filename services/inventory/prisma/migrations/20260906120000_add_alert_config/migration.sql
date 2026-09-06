-- CreateTable
CREATE TABLE "alert_config" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "min_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alert_config_business_id_key" ON "alert_config"("business_id");

-- Row-Level Security (same helper as the init migration)
SELECT enable_tenant_rls('alert_config', 'business_id');
