# T-0401 Winger Service — Scaffold + `winger_account` Model + Winger Contracts

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 05 — Winger Portal

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md` (`winger` row + data ownership), `docs/design/data/data-model.md` (`winger_account`, `winger_catalog_projection`), `docs/design/interfaces/events-catalog.md` (`WINGER` stream, `WingerAuthorized`, `WingerSuspended`), `docs/design/interfaces/api-contract.md` (Winger section)
- Constraints: new service `services/winger` in schema `winger`, role `winger_app`; clone the layout of `services/sales` (`@pos/nest-common` bootstrap, `PlatformModule` NATS `name: 'winger'`, `OutboxRelayService`, `outbox` + `processed_events`, `/healthz` + `/readyz`, multi-stage `Dockerfile`, `vitest.config.ts`, `oxlint.json`); tenant tables get forced RLS; contract changes only in `@pos/contracts`, additive, with round-trip tests; `SCHEMA_VERSION` minor bump; no cross-schema access.
- Do not touch: `services/sales`, `services/catalog`, `services/inventory`, `services/identity`, `services/tenancy`, `web/`, `mobile/`. Endpoint handlers and event consumers are T-0402/T-0403/T-0404.

## Objective

Stand up `services/winger` with the `winger_account` + `winger_catalog_projection` schema, forced RLS, and the `WingerAuthorized` / `WingerSuspended` contract definitions, with health checks and infra wiring in place.

## Scope Boundary

**In scope:**
- `services/winger/` scaffold: `package.json` (`@pos/winger`), Nest app, `config/env.ts` (`WINGER_PORT` 3006, `WINGER_DATABASE_URL`, `NATS_URL`, `INTERNAL_CONTEXT_SECRET`, `WEB_BASE_URL` for `portal_url`), `main.ts`, `HealthModule`, `PlatformModule`, `OutboxRelayService`, `PrismaModule`/`PrismaService`, tenant-context module cloned from `sales`, `Dockerfile`, `vitest.config.ts`, `oxlint.json`.
- Prisma schema + init migration with forced RLS on both tenant tables:
  - `winger_account` (`id`, `business_id`, `user_id` Uuid, `status` `active|suspended` default `active`, `authorized_by` Uuid, `created_at`), unique `(business_id, user_id)`.
  - `winger_catalog_projection` (`business_id`, `product_id`, `name`, `image_url?`, `sell_price` Int, `winger_price?` Int, `currency`, `on_hand` Int default 0, `is_active` Boolean default true, `updated_at`), unique `(business_id, product_id)`.
  - `outbox`, `processed_events`.
- `infra/postgres/initdb/20-service-schemas.sql`: `winger` schema + `winger_app` role.
- `@pos/contracts` (additive): `SUBJECTS.winger = { wingerAuthorized, wingerSuspended }`; `wingerAuthorizedPayload` (`business_id`, `winger_account_id`, `user_id`, `portal_url`, `email`, `locale`) and `wingerSuspendedPayload` (`business_id`, `winger_account_id`) in `EVENT_PAYLOADS`; `WINGER` stream entry; round-trip tests. `SCHEMA_VERSION` minor bump.
- infra: `infra/docker-compose.yml` `winger` service; `infra/k8s/base/winger.yaml` (Deployment + Service + HPA + PDB from the template) + `kustomization.yaml` + `secret.example.yaml`; `.github/workflows/ci.yml` matrix entry + `WINGER_DATABASE_URL`; `WINGER_PORT` in `.env.example`.

**Out of scope:**
- Owner winger-account endpoints + `WingerAuthorized` emission — T-0402.
- `winger_catalog_projection` consumers + `image_url` on `ProductUpserted` — T-0403.
- Winger catalog endpoints + Kong `/v1/winger/*` route — T-0404.

## Acceptance Criteria

- `pnpm --filter @pos/winger build` + `test` pass; `pnpm --filter @pos/winger exec prisma migrate deploy` applies the init migration to the `winger` schema.
- A scoped write to `winger_account` succeeds while an unscoped `count()` returns 0 (forced RLS), asserted in an e2e spec.
- `/healthz` + `/readyz` respond.
- `pnpm --filter @pos/contracts test` green including `WingerAuthorized` / `WingerSuspended` round-trips; `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `docker compose -f infra/docker-compose.yml config` valid with the `winger` service; `kubectl kustomize infra/k8s/base` renders `winger`.
- `winger` Prisma schema references no other service's tables (CI static check).

## Dependencies

- None (Phase 02/03/04 done).

## Implementation Checklist

1. Scaffold `services/winger` from the `services/sales` shape.
2. Prisma schema + init migration + forced RLS on `winger_account` + `winger_catalog_projection`.
3. `winger` schema + `winger_app` role in `20-service-schemas.sql`.
4. `@pos/contracts`: `SUBJECTS.winger`, `wingerAuthorizedPayload`, `wingerSuspendedPayload`, `WINGER` stream, round-trip tests, `SCHEMA_VERSION` bump.
5. infra: compose, k8s manifest + kustomization + secret, CI matrix, `.env.example`.
6. `pnpm -r build/test/lint`; `kustomize`; `docker compose config`; `check-contracts-compat.mjs`; validator.

## Verification

Delivered:

- `services/winger/` scaffold cloned from `services/sales`: Nest app, `config/env.ts`
  (`WINGER_PORT` 3006, `WINGER_DATABASE_URL`, `NATS_URL`, `INTERNAL_CONTEXT_SECRET`,
  `WEB_BASE_URL`), `PlatformModule` (NATS `name: 'winger'`), `PrismaModule` /
  `PrismaService`, `OutboxRelayService`, `WingerModule` (empty — feature wiring
  point for T-0402/03/04), `HealthModule` (`/healthz` + `/readyz`), `src/tenant/*`
  (`TenantGuard` / `RolesGuard` / `InternalContextGuard`), multi-stage `Dockerfile`,
  `vitest.config.ts`, `oxlint.json`.
- Prisma init migration `20260908120000_init`: `winger_account` (unique
  `(business_id, user_id)`, indexes on `(business_id, status)` + `(user_id, status)`),
  `winger_catalog_projection` (composite PK `(business_id, product_id)`, nullable
  `image_url` / `sell_price` / `winger_price` / `currency`, `on_hand` default 0,
  `is_active` default true), `outbox`, `processed_events`. Forced tenant RLS on
  `winger_account` + `winger_catalog_projection`. Applied via `prisma migrate deploy`.
- `@pos/contracts` (additive, `SCHEMA_VERSION` 1.1.0 → 1.2.0):
  `SUBJECTS.winger = { wingerAuthorized, wingerSuspended }`; `wingerAuthorizedPayload`
  (`business_id`, `winger_account_id`, `user_id`, `portal_url`, `email`, `locale`)
  and `wingerSuspendedPayload` (`business_id`, `winger_account_id`) in
  `EVENT_PAYLOADS` + round-trip test.
- infra: `docker-compose.yml` `winger` service + `WINGER_URL` on Kong + Kong
  `depends_on`; `infra/k8s/base/winger.yaml` (Deployment + Service + HPA + PDB) +
  `kustomization.yaml` + `secret.example.yaml`; `.github/workflows/ci.yml` matrix
  entry + `WINGER_DATABASE_URL`. `WINGER_PORT` in `.env.example`. `winger` schema +
  `winger_app` role already in `infra/postgres/initdb/20-service-schemas.sql`.

Evidence:

- `pnpm --filter @pos/winger test` → 2 passed (`test/scaffold.e2e-spec.ts`):
  `/healthz` + `/readyz` respond; scoped write to `winger_account` /
  `winger_catalog_projection` succeeds while an unscoped `count()` returns 0
  (forced RLS).
- `pnpm --filter @pos/winger build` + `lint` clean; `prettier` + `prisma format`
  clean; `prisma migrate deploy` applied `20260908120000_init` to the `winger`
  schema.
- `pnpm --filter @pos/contracts test` → 11 (incl. `WingerAuthorized` /
  `WingerSuspended` round-trips); `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `docker compose -f infra/docker-compose.yml config` valid with the `winger`
  service; `kubectl kustomize infra/k8s/base` renders `winger`.
- Backend suites green: contracts 11, nest-common 16, testing 5, identity 7,
  tenancy 9, catalog 11, inventory 24, sales 20, notifications 22, winger 2.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
