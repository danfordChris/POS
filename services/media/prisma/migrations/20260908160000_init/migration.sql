-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'invoice',
    "ref_id" UUID NOT NULL,
    "public_token" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "document_business_id_kind_ref_id_key" ON "document"("business_id", "kind", "ref_id");
CREATE INDEX "document_public_token_idx" ON "document"("public_token");
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

-- `document` is RELAXED-read: the unauthenticated `/v1/i/{token}/pdf` route
-- looks a row up by `public_token` with no tenant context. Every WRITE stays
-- strictly tenant-scoped.
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "document"
    USING (
        nullif(current_setting('app.business_id', true), '') IS NULL
        OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
    )
    WITH CHECK (
        business_id = nullif(current_setting('app.business_id', true), '')::uuid
    );
