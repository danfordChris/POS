-- CreateTable
CREATE TABLE "winger_account" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "authorized_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "winger_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "winger_catalog_projection" (
    "business_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "sell_price" INTEGER,
    "winger_price" INTEGER,
    "currency" TEXT,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "winger_catalog_projection_pkey" PRIMARY KEY ("business_id", "product_id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "winger_account_business_id_user_id_key" ON "winger_account"("business_id", "user_id");
CREATE INDEX "winger_account_business_id_status_idx" ON "winger_account"("business_id", "status");
CREATE INDEX "winger_account_user_id_status_idx" ON "winger_account"("user_id", "status");
CREATE INDEX "winger_catalog_projection_business_id_is_active_idx" ON "winger_catalog_projection"("business_id", "is_active");
CREATE INDEX "outbox_unsent_idx" ON "outbox"("created_at");

-- ── Row-Level Security (mirrors @pos/nest-common ENABLE_TENANT_RLS_SQL) ────────
CREATE OR REPLACE FUNCTION enable_tenant_rls(
    target_table regclass,
    tenant_column text DEFAULT 'business_id'
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
        'CREATE POLICY tenant_isolation ON %s
             USING (%I = nullif(current_setting(''app.business_id'', true), '''')::uuid)
             WITH CHECK (%I = nullif(current_setting(''app.business_id'', true), '''')::uuid)',
        target_table, tenant_column, tenant_column
    );
END;
$$;

SELECT enable_tenant_rls('winger_account', 'business_id');
SELECT enable_tenant_rls('winger_catalog_projection', 'business_id');
