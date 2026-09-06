-- The public `GET /v1/r/{token}` handler runs with NO tenant context and looks a
-- receipt up by its unguessable `public_token` only. Relax the RLS *read* path
-- on the three tables that render a receipt so an unscoped background/public
-- context can read them; every *write* stays strictly tenant-scoped.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['receipt', 'sale', 'sale_line'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (
           nullif(current_setting(''app.business_id'', true), '''') IS NULL
           OR business_id = nullif(current_setting(''app.business_id'', true), '''')::uuid
         )
         WITH CHECK (
           business_id = nullif(current_setting(''app.business_id'', true), '''')::uuid
         )',
      t
    );
  END LOOP;
END $$;
