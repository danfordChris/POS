# T-0101 Catalog Service — Category + Product Model, Migration, RLS

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/data/data-model.md`, `docs/design/architecture/service-decomposition.md`, `docs/design/interfaces/events-catalog.md`
- Constraints: service owns only its own schema (`catalog`); no `@relation` or query across services; every tenant table gets RLS in the creating migration; wrap fallible I/O in try/catch; no author attribution in commits.
- Do not touch: `services/identity`, `services/tenancy` domain code.

## Objective

Stand up `services/catalog` (`@pos/catalog`) with `category` and `product` tables in the `catalog` schema, a migration that enables + forces tenant RLS on both, and the standard outbox + processed-events tables.

## Scope Boundary

**In scope:**
- `services/catalog/` scaffold mirroring `services/tenancy/` (package.json, nest-cli, tsconfig\*, vitest, oxlint, Dockerfile, config, prisma, platform, health, main/app module).
- `services/catalog/prisma/schema.prisma`: `Category`, `Product`, `OutboxMessage`, `ProcessedEvent`.
- `services/catalog/prisma/migrations/*_init/migration.sql` with `enable_tenant_rls('category','business_id')` and `enable_tenant_rls('product','business_id')`.
- `infra/postgres/initdb/20-service-schemas.sql` already lists `catalog` — verify only.
- `.env.example`: `CATALOG_PORT`.

**Out of scope:**
- HTTP endpoints (T-0102), image upload (T-0103), events emission wiring beyond table creation.

## Acceptance Criteria

- `pnpm --filter @pos/catalog build` and `prisma migrate deploy` against the `catalog` schema both succeed.
- `\d+ category` and `\d+ product` show row level security enabled **and** forced.
- `product` has unique `(business_id, sku)` and `(business_id, code)` and indexes on `(business_id, is_active)` and `(business_id, code)`.
- A query run outside `runInTenantContext` returns zero rows (RLS default-deny).
- `catalog` role cannot select from the `tenancy` schema (permission denied).

## Dependencies

- T-0110, T-0111, T-0115

## Implementation Checklist

1. Copy the `services/tenancy` scaffold to `services/catalog`; rename `@pos/tenancy` → `@pos/catalog`, port 3003.
2. Write `prisma/schema.prisma` mirroring `data-model.md` `category` + `product`.
3. Generate/author the init migration; append the `enable_tenant_rls` helper + calls.
4. `prisma migrate deploy` against `catalog_app`.
5. `pnpm --filter @pos/catalog build`.

## Verification

- `pnpm --filter @pos/catalog build` clean; `prisma migrate deploy` applied `20260902000000_init`.
- `docker exec pos-local-postgres-1 psql -U pos -d pos_dev -c "\d+ catalog.product"` shows `Row Level Security: enabled` + `forced`; same for `catalog.category`.
- Tenant-isolation + RLS default-deny proven by `services/catalog/test/catalog.e2e-spec.ts` (`tenant isolation: business B sees none of business A products`).
- Cross-schema denial re-confirmed from T-0111 (roles have no grant on other schemas).
