-- Business name snapshot for GET /v1/winger/businesses, projected from
-- tenancy.BusinessCreated. Internal: no RLS (consumer writes, unscoped read).
CREATE TABLE "winger_business" (
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',

    CONSTRAINT "winger_business_pkey" PRIMARY KEY ("business_id")
);

-- GET /v1/winger/businesses lists every business a user is an active winger for
-- (a cross-tenant read with no single business context). Relax the RLS *read*
-- path on winger_account so an unscoped context sees the caller's rows, while
-- every *write* stays strictly tenant-scoped.
DROP POLICY IF EXISTS tenant_isolation ON "winger_account";

CREATE POLICY tenant_isolation ON "winger_account"
  USING (
    nullif(current_setting('app.business_id', true), '') IS NULL
    OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
  )
  WITH CHECK (
    business_id = nullif(current_setting('app.business_id', true), '')::uuid
  );
