# T-0004 Tenancy: Business/Membership, Route Guard, RLS

## Status

- `done`
- Last updated: 2026-09-01

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/multi-tenancy.md`, `docs/design/data/data-model.md`, `docs/design/interfaces/api-contract.md`
- Constraints: tenant id never comes from client body/headers — only from the path + membership; RLS denies by default when `app.business_id` is unset; try/catch around transaction setup. NOTE: Prisma 6 removed `$use` middleware — layer-2 enforcement is `runInTenantContext` + `assertTenantContext()`, with RLS (layer 3) as the real backstop. The API connects as non-superuser `pos_app` so `FORCE ROW LEVEL SECURITY` applies.
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

- [x] `POST /v1/businesses` returns 201 and creates an Owner `membership` for the caller (verified in-test via `runInTenantContext` lookup and a follow-up `GET`).
- [x] A member of business A calling `GET /v1/businesses/{B}` gets 403 `not_a_member`.
- [x] Raw `SELECT` on `business` / `membership` with no `app.business_id` bound returns 0 rows; a raw `INSERT` is rejected by the RLS `WITH CHECK`; `assertTenantContext()` throws.
- [x] Staff calling `PATCH /v1/businesses/{id}` (`@Roles('owner')`) gets 403 `role_forbidden`; the Owner gets 200.
- [x] An `operator`-audience token on `GET /v1/businesses/{id}` returns 403 `operator_data_access_denied`.
- [x] Every tenant query in `BusinessesService` / `TenantGuard` runs inside `runInTenantContext` (which issues `set_config('app.business_id', …, true)`); the RLS test proves a "forgotten" path yields no data and no writes.

## Dependencies

- T-0002, T-0003

## Implementation Checklist

- [x] `Business` + `Membership` Prisma models (FKs to `business` and `user`, `@@unique([businessId,userId])`); migration `20260901201947_tenancy_business_membership`.
- [x] Migration appends `enable_tenant_rls(regclass, text)` plpgsql helper + `SELECT enable_tenant_rls('business','id'); enable_tenant_rls('membership','business_id');` → `ENABLE` + `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy.
- [x] `infra/postgres/initdb/10-app-role.sql` creates non-superuser `pos_app` (owns `pos_dev` + `public`); `DATABASE_URL` now uses it.
- [x] `PrismaService.runInTenantContext()` (AsyncLocalStorage + `$transaction` + `set_config`), `currentBusinessId()`, `assertTenantContext()`, `TenantContextError`.
- [x] `TenantGuard` (self-contained bearer parse → operator ⇒ 403 `operator_data_access_denied`; non-user ⇒ 401; membership lookup ⇒ 403 `not_a_member`; attaches `req.user` + `req.membership`).
- [x] `Roles()` decorator + `RolesGuard` (403 `role_forbidden`); `@CurrentMembership()` param decorator.
- [x] `BusinessesModule`: `POST /v1/businesses`, `GET /v1/businesses/:businessId`, `PATCH /v1/businesses/:businessId` (`@Roles('owner')`).
- [x] `test/tenancy.e2e-spec.ts` — 5 cases covering every acceptance row.

## Verification

- `pnpm --filter api test` → 4 files, **19 tests pass** (tenancy e2e ×5, auth e2e ×8, health e2e ×3, filter unit ×3).
- `pnpm --filter api lint` (oxlint) exit 0; `pnpm --filter api build` compiles + OpenAPI regenerated (`/v1/businesses`, `/v1/businesses/{businessId}` present); `openapi:check` in sync.
- `psql` as `pos_app`: `relrowsecurity` + `relforcerowsecurity` = `t` on `business`/`membership`; `INSERT INTO business(name) VALUES('x')` with no GUC → `ERROR: new row violates row-level security policy`.
- Live (`node dist/main.js`): create business → 201; owner `GET` 200; owner `PATCH` 200; non-member `GET` → 403 `not_a_member`; no auth → 401.
- Deviation: Prisma 6 removed `$use` — the "Prisma middleware" checklist item is replaced by `runInTenantContext` + `assertTenantContext()` + RLS. DB reset done via manual `DROP SCHEMA public CASCADE` (Prisma's `migrate reset` refuses to run under Claude Code).
