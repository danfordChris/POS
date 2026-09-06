-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "dedupe_key" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_contact" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_contact_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "notification_business_id_dedupe_key_key" ON "notification"("business_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "notification_business_id_status_idx" ON "notification"("business_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_contact_business_id_user_id_key" ON "notification_contact"("business_id", "user_id");

-- CreateIndex
CREATE INDEX "notification_contact_business_id_role_active_idx" ON "notification_contact"("business_id", "role", "active");

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

SELECT enable_tenant_rls('notification', 'business_id');
SELECT enable_tenant_rls('notification_contact', 'business_id');
