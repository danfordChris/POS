# T-0503 Cross-Tenant Isolation Suite Over Every Data-Plane Route

## Status

- `pending`
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

Run and capture:

- The isolation suite output listing every route asserted, all green.
- `.github/workflows/ci.yml` diff showing the job; a CI run (or local `act`/manual) proving it executes.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
