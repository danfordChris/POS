-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_by" UUID,
    "accepted_at" TIMESTAMPTZ(6),

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitation_token_hash_key" ON "invitation"("token_hash");
CREATE INDEX "invitation_business_id_status_idx" ON "invitation"("business_id", "status");

-- Row-Level Security. Accept looks an invitation up by its unique token_hash
-- with no business context, so the *read* path is relaxed (unset app.business_id
-- ⇒ visible); every *write* stays strictly tenant-scoped.
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitation" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "invitation"
  USING (
    nullif(current_setting('app.business_id', true), '') IS NULL
    OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
  )
  WITH CHECK (
    business_id = nullif(current_setting('app.business_id', true), '')::uuid
  );
