# T-0102 Catalog Service — Product & Category Endpoints, Role-Aware DTO

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md`, `docs/design/interfaces/events-catalog.md`, `docs/design/architecture/multi-tenancy.md`
- Constraints: catalog does not own the membership table — it trusts the Kong-signed internal context (verified by `InternalContextGuard`) for `business_id` + `role`; price fields are Owner-only on write and silently dropped for Staff; `cost_price` never appears in a Staff response; every producer emits via the transactional outbox; wrap fallible I/O in try/catch.
- Do not touch: `services/identity`, `services/tenancy`, `packages/nest-common` messaging internals.

## Objective

Serve the `api-contract.md` Catalog endpoints from `services/catalog` behind the internal-context + tenant + roles guards, with a role-aware product serializer and `CategoryUpserted` / `ProductUpserted` / `PriceChanged` / `ProductDeactivated` emitted via the outbox.

## Scope Boundary

**In scope:**
- `services/catalog/src/tenant/` — `TenantGuard` (context-trusting, no membership table), `RolesGuard`, `CurrentMembership`, `TenantModule`.
- `services/catalog/src/catalog/` — `CatalogService`, `CategoriesController`, `ProductsController`, DTOs, `product-view.ts`.
- `services/catalog/src/consumers/business-created.consumer.ts` — idempotent `tenancy.BusinessCreated` subscriber (bootstrap seam).
- `packages/contracts/src/subjects.ts` + `events.ts` — `SUBJECTS.catalog.*` and `catalog` event payload schemas + `EVENT_PAYLOADS` entries.
- `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml` — `catalog` service + `~/v1/businesses/[^/]+/(categories|products)` route (regex_priority above tenancy's prefix route).
- `infra/docker-compose.yml`, `infra/k8s/base/catalog.yaml`, `infra/k8s/base/kustomization.yaml`, `infra/k8s/base/secret.example.yaml`.
- `.github/workflows/ci.yml` — `catalog` in the service matrix.
- `services/catalog/test/catalog.e2e-spec.ts`.

**Out of scope:**
- Image upload endpoint (T-0103).
- Stock / inventory (T-0104, T-0105).

## Acceptance Criteria

- `GET/POST /v1/businesses/{businessId}/categories` and `GET/POST/PATCH /v1/businesses/{businessId}/products` + `POST .../products/{id}/deactivate` are served by `catalog`.
- An Owner context sees `cost_price` on a product; a Staff context never does (`GET` and `POST` responses).
- A Staff `POST /products` with `cost_price`/`sell_price` creates the product with those fields ignored (`sell_price` = 0), not a 400.
- `GET /products?code=<known>` returns `{ data: [product] }`; `?code=<unknown>` returns 404 with `details: [{ field: "code", issue: "<unknown>" }]`.
- Duplicate `(business_id, sku)` on create → 409 `conflict`.
- An `operator` internal context → 403 `operator_data_access_denied`; a context whose `business_id` ≠ path → 403 `not_a_member`.
- A product write enqueues `ProductUpserted` (+ `PriceChanged` when a price is set/changed) in the same transaction; the outbox relay publishes them.
- Deactivating an active product emits `ProductDeactivated`; a second deactivate is a no-op 2xx.
- The `BusinessCreated` consumer processes the same `event_id` twice with one `processed_events` row.
- `kong config parse` and `kubectl kustomize infra/k8s/base` succeed; `validate_workflow.py` → `WORKFLOW:ok`.

## Dependencies

- T-0101, T-0112, T-0113, T-0114

## Implementation Checklist

1. Add `SUBJECTS.catalog.*` + `catalog` event payloads (+ round-trip test) to `@pos/contracts`.
2. Build the context-trusting `TenantGuard` + copy `RolesGuard` / `CurrentMembership`.
3. `CatalogService` — categories + products CRUD, cursor pagination, scan lookup, `pricesFor(role)`, outbox emits.
4. `product-view.ts` — Owner-only `cost_price`.
5. Controllers with `InternalContextGuard, TenantGuard, RolesGuard` + `@Roles('owner','staff')` on writes.
6. `BusinessCreatedConsumer` via `subscribeWithDlq` + `runIdempotent`.
7. Kong routes, compose, k8s, CI matrix.
8. e2e spec; `pnpm -r build/test/lint/format`; validator.

## Verification

- `services/catalog/test/catalog.e2e-spec.ts` — 11 tests: owner/staff `cost_price` visibility, staff price drop, scan hit + 404-echo, duplicate SKU 409, deactivate idempotent, operator 403, business mismatch 403, tenant isolation, category create + 409, `ProductUpserted`+`PriceChanged` outbox + relay publish, `BusinessCreated` idempotency.
- `pnpm -r build` + `pnpm -r test` green — 54 tests (contracts 6, testing 5, nest-common 16, catalog 11, tenancy 9, identity 7).
- `kong config parse infra/kong/kong.yml` → `parse successful`; `kubectl kustomize infra/k8s/base` → exit 0.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
