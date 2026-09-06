-- The send worker scans `notification` across all tenants (no HTTP surface on
-- this service). Relax the RLS *read* path so an unscoped background context
-- sees every row, while keeping every *write* strictly tenant-scoped.
DROP POLICY IF EXISTS tenant_isolation ON "notification";

CREATE POLICY tenant_isolation ON "notification"
  USING (
    nullif(current_setting('app.business_id', true), '') IS NULL
    OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
  )
  WITH CHECK (
    business_id = nullif(current_setting('app.business_id', true), '')::uuid
  );
