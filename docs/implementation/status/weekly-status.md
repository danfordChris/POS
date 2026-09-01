# Weekly Status

## 2026-09-01

### Summary

- Design + implementation docs complete. Phase 00: T-0001 → T-0004 done (4 of 9 tasks; T-0005–T-0009 remain).
- Local dev runs entirely on the `infra/docker-compose.yml` stack (OrbStack).

### Completed

- `docs/design/` + `docs/implementation/` authored; decision 0001 finalized.
- Git on `main`; four feature commits (docs, scaffold, API base, auth, tenancy).
- **T-0001** repo scaffold · **T-0002** API base (Prisma, `/v1/health`, error envelope, OpenAPI) · **T-0003** auth (register/login/refresh/logout/me + operator audiences, argon2id via hash-wasm, rotating refresh tokens).
- **T-0004 — Tenancy + RLS**:
  - `business` + `membership` models; migration `20260901201947_tenancy_business_membership` with the reusable `enable_tenant_rls()` SQL helper (`ENABLE` + `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy on `nullif(current_setting('app.business_id',true),'')::uuid`).
  - Non-superuser DB role `pos_app` (via `infra/postgres/initdb/`) so RLS FORCE is enforced; `DATABASE_URL` uses it.
  - `PrismaService.runInTenantContext()` (AsyncLocalStorage + `set_config` per transaction), `assertTenantContext()`.
  - `TenantGuard` (path-scoped membership; operator → 403 `operator_data_access_denied`; non-member → 403 `not_a_member`), `Roles()`/`RolesGuard` (403 `role_forbidden`).
  - `POST /v1/businesses`, `GET`/`PATCH /v1/businesses/{businessId}`.
  - 19 tests pass; lint/build/openapi-drift green; RLS backstop and live flow verified.

### Environment changes (this session)

- `postgres:18-alpine`; compose volume at `/var/lib/postgresql`; `infra/postgres/initdb/` mounted to create `pos_app`.
- Host `brew services postgresql@18` stopped; its `pos*` objects dropped.
- `SHADOW_DATABASE_URL` removed from schema/.env (Prisma auto-shadow; `pos_app` has CREATEDB).
- OpenAPI generator/drift moved from `tsx` to `node scripts/*.mjs` against `dist/`; `tsx` removed.
- Prisma pinned to 6.19.3 (`$use` middleware removed in v6 — see T-0004 deviation note).

### In Progress

- None.

### Next Focus

- T-0005 — Invitations: `invitation` model + migration + RLS (`enable_tenant_rls`), `POST/GET/revoke` (Owner) + `POST /v1/invitations/accept`, invitation email via the notifications pipeline (local Mailpit capture).
