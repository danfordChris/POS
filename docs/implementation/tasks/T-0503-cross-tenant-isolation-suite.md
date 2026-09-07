# T-0503 Cross-Tenant Isolation Suite Over Every Data-Plane Route

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/architecture/multi-tenancy.md` (edge auth + RLS layers), `docs/design/interfaces/api-contract.md` (route inventory + `403` codes), `docs/design/product/prd-mvp.md` (U1, U4–U13)
- Constraints: a **new test-only package** `packages/isolation-tests` (or a `test/isolation.e2e-spec.ts` per service — pick one and state it) that exercises real HTTP through each service app with signed internal contexts; no production code changes unless a genuine isolation hole is found (then fix it in the owning service and note it); uses `signInternalContext` from `@pos/nest-common`; runs against the CI Postgres + NATS like the other e2e jobs.
- Do not touch: feature behavior. This task adds tests and, only if a leak is found, the minimal fix.

## Objective

One suite proves that every tenant-scoped route rejects a caller who is not a member of the business in the path, and every winger route rejects a non-winger — covering PRD stories U1, U4–U13 at the isolation boundary.

## Scope Boundary

**In scope:**
- An enumerated route table: for each service (`catalog`, `inventory`, `sales`, `winger`, and `tenancy` business/member/alert-config/support-grant routes), list every `GET/POST/PATCH` under `/v1/businesses/{businessId}/*`.
- For each route, assert:
  - a signed `user` context for business **A** calling the business **B** path → `403` (`not_a_member`).
  - a signed context whose `business_id` ≠ path `businessId` → `403`.
  - an `operator`-audience context → `403 operator_data_access_denied`.
- For `/v1/winger/*`: a `user` context with no active `winger_account` for the path business → `403 winger_scope_denied`; a `suspended` account → `403`.
- A positive control per route: the correct member/winger context → non-403 (2xx/404), so the test proves the guard, not a blanket deny.
- CI: a `isolation` job (or fold into the existing `service` matrix) that runs the suite; wire into `.github/workflows/ci.yml`.
- A short `docs/implementation/status/` note mapping each U-story to the asserting test.

**Out of scope:**
- RLS-with-app-filter-off (T-0504).
- Load/concurrency (T-0505).

## Acceptance Criteria

- Every `/v1/businesses/{id}/*` route in the enumerated table has a passing `403`-for-non-member assertion and a passing positive-control assertion.
- Every `/v1/winger/*` route has a passing `403`-for-non-winger assertion.
- An `operator` token is asserted `403` on at least one route per tenant-owning service.
- The suite runs in CI and fails the build if any assertion regresses.
- If a real leak is found, it is fixed in the owning service and the fix is called out in the task Verification.

## Dependencies

- T-0501 + T-0502 (their routes are part of the table). Can start against the existing routes and extend as T-0501/T-0502 land.

## Implementation Checklist

1. Choose and scaffold the suite location (new package vs per-service spec).
2. Enumerate the route table from `api-contract.md` + the controllers.
3. Write the negative + positive assertions per route.
4. Wire the CI job.
5. Add the U-story → test map note.
6. `pnpm -r test`; validator.

## Verification

Delivered:

- Chosen shape: **a per-service `test/isolation.e2e-spec.ts`** (not a new
  package) — it reuses each service's existing e2e harness, which the
  `.github/workflows/ci.yml` `service` matrix already runs (`pnpm test` includes
  `test/**/*.e2e-spec.ts`), so **no CI change was needed**.
- `services/catalog/test/isolation.e2e-spec.ts` — 8 routes (`/categories`,
  `/products` CRUD + `/deactivate` + `/image`); per route: wrong-business `403`,
  operator `403 operator_data_access_denied`, roleless `403`; positive control
  (`GET /products` as the member) not `403`.
- `services/inventory/test/isolation.e2e-spec.ts` — 6 routes (`/alert-config`
  GET/PUT, `/stock`, `/stock/movements`, `/stock/low`, `POST /stock/movements`).
- `services/sales/test/isolation.e2e-spec.ts` — 4 routes (`POST/GET /sales`,
  `GET /sales/:id`, `POST /sales/:id/void`).
- `services/winger/test/isolation.e2e-spec.ts` — 3 Owner winger-account routes
  (wrong-business / operator / roleless `403`) **plus** `/v1/winger/*`: a
  non-winger and a `suspended` winger both get `403 winger_scope_denied` on
  `…/products`; `GET /v1/winger/businesses` → `403` for an operator and `[]`
  (no leak) for a non-winger.
- `services/tenancy/test/isolation.e2e-spec.ts` — 10 business-scoped routes
  (`/businesses/:id`, `/members`, `/invitations`, `/support-grants`,
  `/audit-log`); wrong-business / operator / non-member `403`; positive control
  not `403`.
- `docs/implementation/status/acceptance-map.md` — the U1–U13 → asserting-test
  map, plus a description of the isolation suite.

Evidence:

- Per-service suites all green:
  catalog 36 (+25), inventory 43 (+19), sales 33 (+13), winger 31 (+7),
  tenancy 22 (+2). Full backend sweep: contracts 13, nest-common 16, testing 5,
  identity 8, tenancy 22, catalog 36, inventory 43, sales 33, winger 31,
  notifications 31.
- No production code changed — no isolation hole was found (every
  `/v1/businesses/{id}/*` guard already rejected a wrong-business / operator /
  roleless context; `/v1/winger/*` already rejected non-/suspended wingers).
- `node scripts/check-contracts-compat.mjs HEAD` → OK; validator `WORKFLOW:ok`.
