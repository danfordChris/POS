-- Runs once, on first initialisation of the postgres volume (after 10-app-role.sql).
--
-- One schema + one non-superuser LOGIN role per microservice, in the shared
-- database. Each role:
--   * owns only its own schema
--   * has its search_path pinned to that schema
--   * has NO grant on `public` or any other service's schema
-- so a service physically cannot read another service's tables.
--
-- CREATEDB is granted for local dev only so `prisma migrate dev` can auto-manage
-- its shadow database. Production roles are provisioned WITHOUT CREATEDB and use
-- `prisma migrate deploy` (which needs no shadow).

-- Lock down the default schema so service roles cannot fall back to it.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

DO $$
DECLARE
  svc text;
  role_name text;
BEGIN
  FOREACH svc IN ARRAY ARRAY[
    'identity', 'tenancy', 'catalog', 'inventory', 'sales', 'winger', 'notifications'
  ]
  LOOP
    role_name := svc || '_app';

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER CREATEDB',
        role_name, role_name
      );
    END IF;

    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', svc, role_name);
    EXECUTE format('ALTER ROLE %I IN DATABASE %I SET search_path = %I', role_name, current_database(), svc);
    EXECUTE format('GRANT ALL ON SCHEMA %I TO %I', svc, role_name);
    EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', role_name);
  END LOOP;
END
$$;
