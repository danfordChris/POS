# T-0111 Infra: NATS + Shared Postgres (Schema per Service) + Kubernetes Base

## Status

- `pending`
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

**In scope:**
- `infra/docker-compose.yml`: add `nats` (JetStream, monitoring port), keep `minio`/`mailpit`; one `postgres` (18) with database `pos`.
- `infra/postgres/initdb/`: for each of `identity`, `tenancy`, `catalog`, `inventory`, `sales`, `winger`, `notifications` — `CREATE SCHEMA <svc> AUTHORIZATION <svc>_app`, `CREATE ROLE <svc>_app LOGIN` (non-superuser, no `CREATEDB`), `ALTER ROLE <svc>_app SET search_path = <svc>`, and NO cross-schema `GRANT`. A shared shadow schema/role for `prisma migrate dev` per service, or use `migrate diff`/`--create-only`.
- Remove the `api` service block from compose (retired in T-0117; leave a comment).
- `infra/k8s/base/`: per-service `Deployment` + `Service` + `HPA` + `PDB` templates, `ConfigMap`/`Secret` stubs, NATS via Helm values, ingress → `gateway` only, `NetworkPolicy` (default-deny + allow gateway).
- `infra/k8s/README.md` (apply order, kustomize/helm usage).
- `.env.example`: per-service `<SVC>_DATABASE_URL` (same host/db, `?schema=<svc>` + `<svc>_app` role), `NATS_URL`, internal-context signing key.

**Out of scope:**
- Service Dockerfiles (each service task adds its own).
- Cloud provider specifics / managed Postgres provisioning.
- Migrating the current `api` schema layout (T-0112/T-0113 relocate tables into `identity` / `tenancy` schemas).

## Acceptance Criteria

- [ ] `docker compose -f infra/docker-compose.yml up -d` → `nats`, `postgres`, `minio`, `mailpit` all healthy.
- [ ] `psql` shows 7 schemas in database `pos`, each owned by its `<svc>_app` role; each role is non-superuser and has `search_path` pinned to its schema.
- [ ] `<svc>_app` cannot `SELECT` from another service's schema (permission denied) — verified for at least one pair.
- [ ] `nats` JetStream reachable on its client + monitoring ports from the host.
- [ ] `infra/k8s/base` renders (`kustomize build` / `helm template`) with no errors.
- [ ] `.env.example` documents every new variable.

## Dependencies

- T-0110

## Implementation Checklist

- [ ] Add `nats` service (JetStream enabled) + healthcheck.
- [ ] Write `infra/postgres/initdb/` scripts: 7 schemas + 7 roles + pinned `search_path`, no cross-schema grants.
- [ ] Update `.env.example` with per-service `<SVC>_DATABASE_URL` + `NATS_URL` + signing key.
- [ ] Author `infra/k8s/base/*` templates + `infra/k8s/README.md`.
- [ ] `docker compose down -v && up -d`; run the isolation check.

## Verification

- Command: `docker compose -f infra/docker-compose.yml up -d && docker compose -f infra/docker-compose.yml ps && kustomize build infra/k8s/base >/dev/null`
- Evidence: `compose ps` (healthy), `\dn` from psql showing the 7 schemas + owners, a cross-schema `SELECT` denied, and the kustomize/helm render exit code, pasted into the PR.
