-- CreateTable
CREATE TABLE "stock_item" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_threshold" INTEGER NOT NULL DEFAULT 0,
    "product_active" BOOLEAN NOT NULL DEFAULT true,
    "low_stock_open" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "reason" TEXT,
    "reference_type" TEXT,
    "reference_id" UUID,
    "created_by" UUID,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservation" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'held',
    "lines" JSONB NOT NULL,
    "sale_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "stock_reservation_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "stock_item_business_id_product_id_key" ON "stock_item"("business_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_item_business_id_product_active_idx" ON "stock_item"("business_id", "product_active");

-- CreateIndex
CREATE INDEX "stock_movement_business_id_product_id_created_at_idx" ON "stock_movement"("business_id", "product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movement_business_id_idempotency_key_key" ON "stock_movement"("business_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "stock_reservation_business_id_status_idx" ON "stock_reservation"("business_id", "status");

-- CreateIndex
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

SELECT enable_tenant_rls('stock_item', 'business_id');
SELECT enable_tenant_rls('stock_movement', 'business_id');
SELECT enable_tenant_rls('stock_reservation', 'business_id');
