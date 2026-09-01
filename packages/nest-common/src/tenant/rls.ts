/**
 * SQL helper to inline into a service's first migration. Defines
 * `enable_tenant_rls('<table>' [, '<tenant_col>'])`, which enables + FORCEs RLS
 * and adds the standard `tenant_isolation` policy keyed on the `app.business_id`
 * GUC. Call it once per tenant table.
 *
 * The service must connect as a NON-superuser role for `FORCE ROW LEVEL SECURITY`
 * to take effect.
 */
export const ENABLE_TENANT_RLS_SQL = `CREATE OR REPLACE FUNCTION enable_tenant_rls(
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
$$;`;
