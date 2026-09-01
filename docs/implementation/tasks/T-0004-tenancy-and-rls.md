# T-0004 Tenancy: Business/Membership, Route Guard, RLS

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/multi-tenancy.md`, `docs/design/data/data-model.md`, `docs/design/interfaces/api-contract.md`
- Constraints: tenant id never comes from client body/headers — only from the path + membership; RLS denies by default when `app.business_id` is unset; try/catch around transaction setup.
- Do not touch: catalog/stock/sales models (Phase 01+).

## Objective

Path-scoped tenant routes resolve the caller's membership, bind `app.business_id` per transaction, and PostgreSQL RLS blocks any cross-tenant row independently of application code.

## Scope Boundary

**In scope:**
- `business` and `membership` models + migration; RLS policies on both.
- `POST /v1/businesses` (creator → Owner), `GET/PATCH /v1/businesses/{businessId}`.
- `TenantGuard`: loads `Membership` for `{ user, businessId }`; 403 `not_a_member` if absent; attaches role.
- `RoleGuard` decorator for Owner-only routes (403 `role_forbidden`).
- Prisma middleware + transaction wrapper issuing `SET LOCAL app.business_id = $1`.
- Generic RLS policy template applied to every future tenant table (documented helper).
- Operator audience rejected on all `/v1/businesses/*` routes.

**Out of scope:**
- Invitations (T-0005).
- Support-access grants (Phase 05).

## Acceptance Criteria

- [ ] `POST /v1/businesses` creates the business and an Owner `membership` for the caller.
- [ ] Member of business A calling any `/v1/businesses/{B}/*` route gets 403 `not_a_member`.
- [ ] With the Prisma tenant filter disabled in a test, a query on `membership`/`business` still returns zero rows when `app.business_id` is unset (RLS backstop).
- [ ] Staff calling an Owner-only route gets 403 `role_forbidden`.
- [ ] An `operator`-audience token on `/v1/businesses/{id}` returns 403 `operator_data_access_denied`.
- [ ] Every data-plane transaction sets `app.business_id`; a code path that forgets it fails a unit test.

## Dependencies

- T-0002, T-0003

## Implementation Checklist

- [ ] Add `business` + `membership` models per `data-model.md`; migration includes `ENABLE ROW LEVEL SECURITY` + policies.
- [ ] Implement `POST /businesses` + `GET/PATCH /businesses/{id}`.
- [ ] Implement `TenantGuard` and `RoleGuard`.
- [ ] Add a `runInTenantContext(businessId, fn)` wrapper doing `SET LOCAL` inside a transaction, with try/catch.
- [ ] Add Prisma middleware asserting a bound `business_id` on tenant models.
- [ ] Write a reusable migration helper for RLS on future tenant tables + document it in `data-model.md` follow-up note.
- [ ] Tests for every Acceptance Criteria row, including the RLS-only test.

## Verification

- Command: `pnpm --filter api test tenancy`
- Evidence: test report showing cross-tenant 403s, RLS-only zero-row result, role-guard 403, and operator rejection, pasted into the PR.
