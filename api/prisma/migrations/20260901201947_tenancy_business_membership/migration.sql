-- CreateTable
CREATE TABLE "business" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'TZ',
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "subscription_status" TEXT NOT NULL DEFAULT 'trialing',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "invited_by" UUID,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membership_user_id_idx" ON "membership"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_business_id_user_id_key" ON "membership"("business_id", "user_id");

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- Reusable helper: enable + FORCE RLS on a tenant table and add the standard
-- isolation policy keyed on the `app.business_id` GUC. Future tenant tables call
-- `SELECT enable_tenant_rls('<table>');` (defaults to the `business_id` column).
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

SELECT enable_tenant_rls('business', 'id');
SELECT enable_tenant_rls('membership', 'business_id');
