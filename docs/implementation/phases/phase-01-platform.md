# Phase 01 — Platform and Core Services

## Status

- `done`
- Last updated: 2026-09-02

## Objective

Stand up the microservice platform (monorepo layout, shared packages, NATS, gateway) and deliver the first two domain services, `identity` and `tenancy`, by relocating the Phase 00 monolith logic.

## Scope

- Monorepo restructure: `services/<name>/`, `packages/<name>/`. `web/`, `mobile/`, `infra/` unchanged.
- Shared packages:
  - `@pos/contracts` — zod schemas for events + RPC, subject constants, internal-context shape, error codes.
  - `@pos/nest-common` — error-envelope filter, correlation-id middleware, zod env config, NATS bootstrap (events + request/reply), transactional-outbox relay + `processed_events` idempotency helper, `runInTenantContext` + `enable_tenant_rls` snippet, `/healthz` + `/readyz`, OpenTelemetry init, internal-context sign/verify.
- `services/gateway` — public REST `/v1/*`; verifies user JWT locally; rejects operator tokens on data routes; `tenancy.resolveMembership` with Redis cache (bust on `MembershipSuspended`); forwards signed internal context; composes OpenAPI; rate limiting; not-found envelope.
- `services/identity` — relocate `api/src/auth/*` + `user`/`operator`/`refresh_token` tables into the `identity` schema. RPC: `getUser`, `verifyToken`. Public (via gateway): `/v1/auth/*`. Emits `UserRegistered`.
- `services/tenancy` — relocate `api/src/businesses/*` + `api/src/tenancy/*` + `business`/`membership` tables into the `tenancy` schema, with RLS. RPC: `resolveMembership`, and `getUser` client. Public: `/v1/businesses/*`. Emits `BusinessCreated`, `MembershipCreated`, `MembershipSuspended`.
- `infra/docker-compose.yml` — add NATS (JetStream), one Postgres with a schema + non-superuser role per service, the three services. Retire the single `api` container.
- `infra/k8s/` — base manifests: per-service Deployment + Service + HPA + PDB, ConfigMap/Secret, NATS StatefulSet (Helm values), ingress → gateway only, NetworkPolicy.
- CI: per-service lint/test/build/dockerbuild jobs + `@pos/contracts` compatibility check + workflow-doc job.
- Delete the old monolith `api/` once `gateway`/`identity`/`tenancy` pass parity tests.

## Features

- Every Phase 00 auth + business behaviour works end to end through the gateway with identical request/response contracts.
- A domain event (`BusinessCreated`) is published via outbox and observed on JetStream.
- OpenTelemetry trace spans one request across gateway → tenancy → identity.

## Tasks

- [x] T-0110 Monorepo restructure + `@pos/contracts` + `@pos/nest-common`
- [x] T-0111 `infra`: NATS + shared Postgres (schema per service) in compose; k8s base manifests
- [x] T-0112 `services/identity` (auth relocation, `identity` schema, RPC, `UserRegistered`)
- [x] T-0113 `services/tenancy` (businesses/memberships relocation, `tenancy` schema + RLS, `resolveMembership` RPC, events)
- [x] T-0114 Edge gateway — **Kong** (DB-less + `pos-internal-context` Lua plugin; NestJS gateway dropped)
- [x] T-0115 Transactional outbox + idempotent-consumer helpers + `@pos/testing` + `NatsModule`
- [x] T-0116 Per-service CI + contracts compatibility check
- [x] T-0117 Parity coverage map + delete `api/`

## Acceptance Criteria

- [ ] `docker compose up` brings up NATS, one Postgres with a schema per service, `gateway`, `identity`, `tenancy` — all `healthy`.
- [ ] `POST /v1/auth/register|login|refresh|logout`, `GET /v1/auth/me`, `POST /v1/businesses`, `GET|PATCH /v1/businesses/{id}` behave exactly as at end of Phase 00 (parity suite green).
- [ ] Operator token → 403 `operator_data_access_denied` at the gateway on `/v1/businesses/{id}`.
- [ ] Member of business A → 403 `not_a_member` on business B (gateway) and `tenancy` RLS returns 0 rows with no `business_id`.
- [ ] `BusinessCreated` is emitted through the outbox and consumable from JetStream; redelivery is idempotent.
- [ ] A tampered internal context on a direct call to `tenancy` is rejected.
- [ ] No service's Prisma schema references another service's tables (static check passes).
- [ ] `api/` is removed; nothing imports from it.

## Blockers

- Decision 0002 defaults confirmed (or explicitly accepted as-is) — see `docs/changes/proposed/0002-service-architecture.md`.

## Linked Tasks

- `docs/implementation/tasks/`
