# T-0111 Infra: NATS + Shared Postgres (Schema per Service) + Kubernetes Base

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/system-overview.md`, `docs/design/architecture/service-decomposition.md`, `docs/design/integrations/README.md`
- Constraints: local stack runs with zero external accounts; every service gets `/healthz` + `/readyz`; secrets via env only.
- Do not touch: service application code (other tasks).

## Objective

`docker compose up` starts NATS (JetStream), one Postgres holding one database with a schema + non-superuser role per service, MinIO, and Mailpit; `infra/k8s/` holds base manifests for every service.

## Scope Boundary

**In scope (as built):**
- `infra/docker-compose.yml`: added `nats` (`-js` JetStream, `-m 8222` monitoring) + `nats-data` volume + `/healthz` healthcheck. Kept the shared `postgres:18-alpine` on database `pos_dev` (kept, not renamed, so the reference `api` keeps running until T-0117 deletes it — noted in the compose header).
- `infra/postgres/initdb/20-service-schemas.sql`: for each of `identity`, `tenancy`, `catalog`, `inventory`, `sales`, `winger`, `notifications` — `CREATE ROLE <svc>_app LOGIN NOSUPERUSER`, `CREATE SCHEMA <svc> AUTHORIZATION <svc>_app`, `ALTER ROLE ... SET search_path = <svc>`, `REVOKE ALL ON SCHEMA public FROM <svc>_app` (and from `PUBLIC`). No cross-schema `GRANT`. `CREATEDB` is granted **in dev only** (for `prisma migrate dev` shadow); production roles are provisioned without it and use `migrate deploy`.
- `10-app-role.sql` unchanged — `pos_app` still owns `public` for the reference `api`.
- `infra/k8s/base/`: `namespace`, `pos-shared` ConfigMap, `pos-secrets` example Secret, three `NetworkPolicy` (default-deny + allow-ingress-to-gateway + allow-intra-namespace), single-node NATS `StatefulSet` + `Service`, and `gateway` / `identity` / `tenancy` (`Deployment` + `Service` + `HPA` + `PDB`; `Ingress` for `gateway`). `kustomization.yaml`.
- `infra/k8s/examples/service.template.yaml` + `infra/k8s/README.md`.
- `.env.example`: `<SVC>_DATABASE_URL` × 7, `NATS_URL`, `NATS_MONITOR_URL`, `INTERNAL_CONTEXT_SECRET`, `INTERNAL_CONTEXT_TTL_SECONDS`, `GATEWAY_PORT`.

**Out of scope:**
- Service Dockerfiles (each service task adds its own).
- Cloud provider specifics / managed Postgres provisioning.
- Migrating the current `api` schema layout (T-0112/T-0113 relocate tables into `identity` / `tenancy` schemas).

## Acceptance Criteria

- [x] `docker compose up -d` → `nats`, `postgres`, `redis`, `minio`, `mailpit` all `healthy`.
- [x] `pg_namespace` shows the 7 service schemas, each owned by its `<svc>_app` role; every `*_app` role has `rolsuper = f` and `search_path` pinned to its own schema (`{search_path=identity}` etc.).
- [x] `identity_app` → `CREATE TABLE` in `identity` succeeds; `SELECT ... FROM tenancy.*` → `ERROR: permission denied for schema tenancy`. `has_schema_privilege('tenancy_app','public','USAGE')` → `f`.
- [x] NATS `/healthz` → `{"status":"ok"}` on `:8222`; `/varz` shows JetStream enabled; client port `:4222` mapped.
- [x] `kubectl kustomize infra/k8s/base` renders (exit 0, no warnings) — 20 documents: Namespace, ConfigMap, Secret, 3× NetworkPolicy, StatefulSet+Service (nats), 3× (Deployment+Service+HPA+PDB), Ingress.
- [x] `.env.example` documents every new variable; the reference `api` still passes its 16 tests against `public`.

## Dependencies

- T-0110

## Implementation Checklist

- [x] `nats` service (`-js -m 8222`) + `nats-data` volume + healthcheck in compose.
- [x] `infra/postgres/initdb/20-service-schemas.sql` — 7 roles + 7 schemas + pinned `search_path`, `public` revoked, no cross-schema grants.
- [x] `.env.example` + local `.env` updated with per-service URLs, NATS, internal-context secret.
- [x] `infra/k8s/base/*` + `infra/k8s/examples/service.template.yaml` + `infra/k8s/README.md`.
- [x] `docker compose down -v && up -d`; ran the schema/role/isolation checks; re-applied `api` migrations.

## Verification

- `docker compose -f infra/docker-compose.yml up -d && docker compose ... ps` → 5 services healthy.
- `psql` (as `pos`): schema owners table, `pg_roles` (`rolsuper=f`), `pg_db_role_setting` (search_path pins).
- `psql` (as `identity_app`): `CREATE TABLE` ok in `identity`; `SELECT FROM tenancy.*` → permission denied.
- `curl :8222/healthz` → `{"status":"ok"}`; `curl :8222/varz` → jetstream enabled.
- `kubectl kustomize infra/k8s/base` → exit 0; `docker compose config -q` → valid.
- `pnpm --filter api test` → 16 pass (reference stack still green after DB recreate).
