-- CreateTable
CREATE TABLE "support_access_grant" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "granted_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_access_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID,
    "actor_id" UUID NOT NULL,
    "actor_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_access_grant_business_id_status_idx" ON "support_access_grant"("business_id", "status");
CREATE INDEX "support_access_grant_operator_id_idx" ON "support_access_grant"("operator_id");
CREATE INDEX "audit_log_business_id_created_at_idx" ON "audit_log"("business_id", "created_at");

-- support_access_grant: an Owner reads scoped (only their business's grants);
-- an operator lists their own grants across businesses with no business context,
-- so the *read* path is relaxed. Every *write* stays strictly tenant-scoped.
ALTER TABLE "support_access_grant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_access_grant" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "support_access_grant"
  USING (
    nullif(current_setting('app.business_id', true), '') IS NULL
    OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
  )
  WITH CHECK (
    business_id = nullif(current_setting('app.business_id', true), '')::uuid
  );

-- audit_log: the operator/admin reader lists rows with no business context, so
-- the *read* path is relaxed (unset app.business_id ⇒ visible); a scoped write
-- still checks business_id when it is set.
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "audit_log"
  USING (
    nullif(current_setting('app.business_id', true), '') IS NULL
    OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
  )
  WITH CHECK (
    business_id IS NULL
    OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
  );

-- Control-plane read path. The operator `/v1/admin/businesses` list runs with no
-- business context and needs id / name / subscription_status / member counts
-- across all tenants. Add a SELECT-only PERMISSIVE policy that only matches when
-- `app.business_id` is unset — the existing strict `tenant_isolation` policy is
-- untouched, so every scoped query behaves exactly as before. Writes stay strict.
CREATE POLICY control_plane_read ON "business"
  FOR SELECT USING (nullif(current_setting('app.business_id', true), '') IS NULL);

CREATE POLICY control_plane_read ON "membership"
  FOR SELECT USING (nullif(current_setting('app.business_id', true), '') IS NULL);
