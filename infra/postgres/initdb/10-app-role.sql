-- Runs once, on first initialisation of the postgres volume.
-- Creates the non-superuser role the API connects as. RLS FORCE only takes
-- effect for non-superusers, so the app must not use the bootstrap superuser.

CREATE ROLE pos_app WITH LOGIN PASSWORD 'pos_app' CREATEDB;

ALTER DATABASE pos_dev OWNER TO pos_app;
GRANT ALL PRIVILEGES ON DATABASE pos_dev TO pos_app;

GRANT ALL ON SCHEMA public TO pos_app;
ALTER SCHEMA public OWNER TO pos_app;
