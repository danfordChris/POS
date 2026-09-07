# T-0504 RLS-Only Backstop Test (Application Tenant Filter Bypassed)

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/architecture/multi-tenancy.md` (layer 4 — `FORCE ROW LEVEL SECURITY`, `app.business_id` GUC per txn, non-superuser role per schema), `docs/design/data/data-model.md` (which tables are tenant-scoped per service)
- Constraints: test-only; each tenant-owning service (`catalog`, `inventory`, `sales`, `winger`, `tenancy`, `notifications`) gets one `rls-backstop.e2e-spec.ts`; the test connects as the service's own non-superuser role (the same `*_DATABASE_URL` the app uses), seeds rows for business A **inside** a tenant context, then issues reads **without** any `app.business_id` set and with a **foreign** id set, asserting zero rows both ways; also asserts a write with a mismatched `app.business_id` is rejected (`WITH CHECK`).
- Do not touch: production code, unless a table is found not actually FORCE-RLS'd (then add the missing `enable_tenant_rls(...)` migration in the owning service and note it).

## Objective

Prove that if the application-level tenant filter were bypassed, PostgreSQL Row-Level Security still leaks zero rows across tenants for every tenant-owning service.

## Scope Boundary

**In scope:**
- Per service, an enumerated list of its tenant tables (from `data-model.md` + the Prisma schema).
- For each table:
  - seed ≥ 1 row for business A via `runInTenantContext(A)`.
  - `SELECT count(*)` with `SET app.business_id = ''` (unset/empty) → expect `0` for strictly-scoped tables; for tables whose **read** policy is intentionally relaxed (documented: `notification`, `winger_account`, `winger_business` where applicable) assert the documented behavior instead and comment why.
  - `SELECT count(*)` with `SET app.business_id = '<business B uuid>'` → expect `0`.
  - `INSERT` with `SET app.business_id = '<B>'` but `business_id = '<A>'` → expect a `WITH CHECK` violation.
- A brief matrix in `docs/implementation/status/` listing each table and its policy (strict / relaxed-read) so the intentional relaxations are visible.

**Out of scope:**
- Superuser behaviour (superusers bypass FORCE RLS by design; not part of the runtime path).
- The app-level guard tests (T-0503).

## Acceptance Criteria

- Every strictly-scoped tenant table in every tenant-owning service returns `0` rows for an unset and a foreign `app.business_id`.
- Every intentionally relaxed-read table has an explicit assertion of its documented behaviour plus a comment linking the migration that relaxed it.
- A cross-tenant `INSERT` (mismatched `app.business_id` vs `business_id`) is rejected for every tenant table.
- If any table is found without FORCE RLS, a migration adds it and the task Verification names the table + migration.

## Dependencies

- None beyond the services existing. T-0501/T-0502 add `invitation` / `support_access_grant` / `audit_log` — extend the suite when they land.

## Implementation Checklist

1. Enumerate tenant tables per service.
2. Write `rls-backstop.e2e-spec.ts` per service with the unset / foreign / bad-write assertions.
3. Add the policy matrix note.
4. `pnpm -r test`; validator.

## Verification

Delivered:

- `services/{catalog,inventory,sales,winger,notifications,tenancy}/test/rls-backstop.e2e-spec.ts`
  — each seeds one row per tenant table for business A via `runInTenantContext(A)`
  (raw `INSERT`, so `WITH CHECK` passes), then, with the app filter bypassed
  (raw SQL, no / a foreign `app.business_id`), asserts:
  - **strict** tables → `0` rows for an unset `app.business_id` and for a foreign one;
  - **relaxed-read** tables → rows visible unscoped (documented) but `0` for a
    foreign `app.business_id`;
  - **every** table → a cross-tenant `INSERT` (`SET LOCAL app.business_id = B`,
    row `business_id = A`) is rejected by `WITH CHECK`; and (tenancy) an unscoped
    `INSERT` with no `business_id` is rejected.
- `docs/implementation/status/rls-policy-matrix.md` — the full table-by-table
  matrix (strict / relaxed-read / none) with the reason each relaxation exists
  and the migration that introduced it.

Findings:

- **No table needed a new `enable_tenant_rls` migration** — every tenant table
  already had FORCE RLS.
- Two tables were reclassified from the task's initial assumption after reading
  the migrations: `sales.sale` and `sales.sale_line` are **relaxed-read** (the
  public `GET /v1/r/{token}` receipt handler, migration `20260907140000`), not
  strict. Captured in the matrix.

Evidence:

- Suites green: catalog 43 (+7), inventory 59 (+16), sales 48 (+15),
  winger 37 (+6), notifications 37 (+6), tenancy 33 (+11).
- Full backend sweep: contracts 13, nest-common 16, testing 5, identity 8,
  tenancy 33, catalog 43, inventory 59, sales 48, winger 37, notifications 37.
- `node scripts/check-contracts-compat.mjs HEAD` → OK; validator `WORKFLOW:ok`.
