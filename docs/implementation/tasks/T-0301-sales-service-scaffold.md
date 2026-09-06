# T-0301 Sales Service — Scaffold + Models + Sale Events

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md` (`sales` row), `docs/design/data/data-model.md` (`sale`, `sale_line`, `receipt`, `sale_number_counter`, `product_cache`), `docs/design/interfaces/events-catalog.md` (`SaleCompleted`, `SaleVoided`, `SALES` stream), `docs/design/interfaces/api-contract.md` (Sales & receipts)
- Constraints: new service `services/sales` in the `sales` schema, role `sales_app`; clone the layout of `services/inventory` (`@pos/nest-common` bootstrap, `PlatformModule` NATS `name: 'sales'`, `OutboxRelayService`, `outbox` + `processed_events`, `/healthz` + `/readyz`, Dockerfile); tenant tables get forced RLS; contracts (zod schemas + subjects) only in `@pos/contracts`, additive with round-trip tests; no cross-schema access.
- Do not touch: `services/inventory` (T-0304 adds its consumer), `catalog`, `tenancy`, `web/`, `mobile/`.

## Objective

Stand up `services/sales` with the `sale` / `sale_line` / `receipt` / `sale_number_counter` / `product_cache` schema and the `SaleCompleted` / `SaleVoided` contract definitions.

## Scope Boundary

**In scope:**
- `services/sales/` scaffold: `package.json` (`@pos/sales`), Nest app, config/env (`SALES_PORT` 3005, `SALES_DATABASE_URL`, `NATS_URL`, `INTERNAL_CONTEXT_SECRET`, `WEB_BASE_URL` for the receipt link), `main.ts`, `HealthModule`, `PlatformModule`, `OutboxRelayService`, multi-stage `Dockerfile`, `vitest.config.ts`, `oxlint.json`.
- Prisma schema + init migration (RLS on `sale`, `sale_line`, `receipt`, `sale_number_counter`, `product_cache`):
  - `sale` (`number` Int, `status`, `subtotal`/`discount_total`/`total` Int minor units, `currency`, `sold_by` Uuid, `customer_label?`, `created_at`, `voided_at?`), unique `(business_id, number)`.
  - `sale_line` (`sale_id`, `product_id`, `name_snapshot`, `unit_price_snapshot` Int, `quantity` Int, `discount` Int default 0, `line_total` Int).
  - `receipt` (`sale_id` unique, `public_token` unique, `business_name_snapshot`, `currency`, `status` `issued|void`, `issued_at`).
  - `sale_number_counter` (`business_id` pk, `next_number` Int default 1).
  - `product_cache` (unique `(business_id, product_id)`, `name`, `sell_price` Int, `currency`).
  - `outbox`, `processed_events`.
- `@pos/contracts`: `SUBJECTS.sales = { saleCompleted, saleVoided }`; `saleCompletedPayload` (`business_id`, `sale_id`, `reservation_id`, `lines: [{ product_id, quantity }]`, `total`, `currency`) and `saleVoidedPayload` (`business_id`, `sale_id`, `lines: [{ product_id, quantity }]`) in `EVENT_PAYLOADS` + round-trip tests.
- infra: `infra/docker-compose.yml` `sales` service; `infra/k8s/base/sales.yaml` (Deployment + Service + HPA + PDB from the template) + `kustomization.yaml` + `secret.example.yaml`; `.github/workflows/ci.yml` matrix entry + `SALES_DATABASE_URL`.
- `SALES_PORT` in `.env.example`.

**Out of scope:**
- `POST /sales` handler + saga — T-0302.
- Void / public receipt / read endpoints — T-0304 / T-0305 / T-0306.
- Any Kong route (T-0302 adds `/sales`, T-0305 adds `/r`).

## Acceptance Criteria

- `pnpm --filter @pos/sales build` + `test` pass; `pnpm --filter @pos/sales exec prisma migrate deploy` applies the init migration to the `sales` schema.
- `docker compose -f infra/docker-compose.yml config` valid with the `sales` service + role; `kubectl kustomize infra/k8s/base` renders `sales`.
- `pnpm --filter @pos/contracts test` green including `SaleCompleted` / `SaleVoided` round-trips; `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `sales` Prisma schema references no other service's tables (CI static check).
- `/healthz` + `/readyz` respond (covered by the health module).

## Dependencies

- None (Phase 02/03 done).

## Implementation Checklist

1. Scaffold `services/sales` from the `inventory` shape.
2. `@pos/contracts`: sale subjects + payloads + round-trip tests.
3. Prisma schema + init migration + RLS on the five tenant tables.
4. infra: compose, k8s manifest + kustomization + secret, CI matrix, `.env.example`.
5. `pnpm -r build/test/lint`; `kustomize`; `docker compose config`; validator.

## Verification

Delivered:

- `services/sales/` scaffold cloned from `inventory`: Nest app, `config/env.ts`
  (`SALES_PORT` 3005, `SALES_DATABASE_URL`, `NATS_URL`,
  `INTERNAL_CONTEXT_SECRET`, `WEB_BASE_URL`), `PlatformModule` (NATS
  `name: 'sales'`), `PrismaModule`/`PrismaService`, `OutboxRelayService`,
  `HealthModule` (`/healthz` + `/readyz`), multi-stage `Dockerfile`,
  `vitest.config.ts`, `oxlint.json`.
- Prisma init migration `20260907120000_init`: `sale` (unique
  `(business_id, number)` + `(business_id, idempotency_key)`), `sale_line`
  (FK → `sale` cascade), `receipt` (unique `sale_id` + `public_token`,
  `business_name_snapshot` + `currency`), `sale_number_counter`
  (`business_id` pk), `product_cache` (unique `(business_id, product_id)`),
  `outbox`, `processed_events`. Forced tenant RLS on the five tenant tables.
  Applied via `prisma migrate deploy`.
- `@pos/contracts` (additive): `SUBJECTS.sales = { saleCompleted, saleVoided }`;
  `saleCompletedPayload` (`business_id`, `sale_id`, `reservation_id`,
  `lines: [{ product_id, quantity }]`, `total`, `currency`) and
  `saleVoidedPayload` (`business_id`, `sale_id`, `lines`) in `EVENT_PAYLOADS`
  + round-trip test.
- infra: `docker-compose.yml` `sales` service; `infra/k8s/base/sales.yaml`
  (Deployment + Service + HPA + PDB); `kustomization.yaml` +
  `secret.example.yaml`; `.github/workflows/ci.yml` matrix entry +
  `SALES_DATABASE_URL`. `SALES_PORT` in `.env.example`. `sales` schema + role
  already in `infra/postgres/initdb/20-service-schemas.sql`.

Evidence:

- `pnpm --filter @pos/sales test` → 2 passed (`test/scaffold.e2e-spec.ts`):
  `/healthz` + `/readyz` respond; scoped write to `product_cache` /
  `sale_number_counter` succeeds while an unscoped `count()` returns 0
  (forced RLS).
- `pnpm --filter @pos/contracts test` → 10 (incl. `SaleCompleted` / `SaleVoided`
  round-trips); `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `pnpm --filter @pos/sales build` + `lint` clean; `prettier` + `prisma format`
  clean; `docker compose -f infra/docker-compose.yml config` valid.
- Backend suites green: contracts 10, nest-common 16, testing 5, identity 7
  (one pre-existing outbox-relay timing flake, passes on re-run), tenancy 9,
  catalog 11, inventory 23, sales 2, notifications 22.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
