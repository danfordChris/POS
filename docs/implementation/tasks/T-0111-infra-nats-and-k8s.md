# T-0111 Infra: NATS + Per-Service Databases + Kubernetes Base

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/system-overview.md`, `docs/design/architecture/service-decomposition.md`, `docs/design/integrations/README.md`
- Constraints: local stack must run with zero external accounts; every service gets `/healthz` + `/readyz`; secrets via env only.
- Do not touch: service application code (other tasks).

## Objective

`docker compose up` starts NATS (JetStream), one Postgres with a database + non-superuser role per service, MinIO, and Mailpit; `infra/k8s/` holds base manifests for every service.

## Scope Boundary

**In scope:**
- `infra/docker-compose.yml`: add `nats` (JetStream, monitoring port), keep `minio`/`mailpit`; replace the single DB init with `infra/postgres/initdb/` creating `identity_db`, `tenancy_db`, `catalog_db`, `inventory_db`, `sales_db`, `winger_db`, `notifications_db`, each owned by a `<svc>_app` non-superuser role.
- Remove the `api` service block from compose (retired in T-0117; leave a comment).
- `infra/k8s/base/`: per-service `Deployment` + `Service` + `HPA` + `PDB` templates, `ConfigMap`/`Secret` stubs, NATS via Helm values, ingress → `gateway` only, `NetworkPolicy` (default-deny + allow gateway).
- `infra/k8s/README.md` (apply order, kustomize/helm usage).
- `.env.example`: per-service `*_DATABASE_URL`, `NATS_URL`, internal-context signing key.

**Out of scope:**
- Service Dockerfiles (each service task adds its own).
- Cloud provider specifics / managed Postgres provisioning.

## Acceptance Criteria

- [ ] `docker compose -f infra/docker-compose.yml up -d` → `nats`, `postgres`, `minio`, `mailpit` all healthy.
- [ ] `psql` shows the 7 service databases, each owned by its `<svc>_app` role; each role is non-superuser.
- [ ] `nats` JetStream reachable on its client + monitoring ports from the host.
- [ ] `infra/k8s/base` renders (`kustomize build` / `helm template`) with no errors.
- [ ] `.env.example` documents every new variable.

## Dependencies

- T-0110

## Implementation Checklist

- [ ] Add `nats` service (JetStream enabled) + healthcheck.
- [ ] Write `infra/postgres/initdb/` scripts for the 7 DBs + roles.
- [ ] Update `.env.example`.
- [ ] Author `infra/k8s/base/*` templates + `infra/k8s/README.md`.
- [ ] `docker compose down -v && up -d`; verify.

## Verification

- Command: `docker compose -f infra/docker-compose.yml up -d && docker compose -f infra/docker-compose.yml ps && kustomize build infra/k8s/base >/dev/null`
- Evidence: `compose ps` (healthy), `\l` from psql showing the 7 DBs, and the kustomize/helm render exit code, pasted into the PR.
