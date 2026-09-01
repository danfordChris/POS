# Weekly Status

## 2026-09-01

### Summary

- Design + implementation docs complete. Phase 00 in progress: T-0001, T-0002, T-0003 done.
- Local dev now runs entirely on the `infra/docker-compose.yml` stack (OrbStack); the host-PostgreSQL workaround is removed.

### Completed

- `docs/design/` + `docs/implementation/` authored; decision 0001 finalized.
- Git initialized on `main`; docs + scaffold + API base committed.
- **T-0001 — repo scaffold**: pnpm workspace (`api` + `web`) + `mobile` Flutter + `infra/`.
- **T-0002 — API base**: Prisma + PostgreSQL, `GET /v1/health` (200/503), `AllExceptionsFilter` envelope, `ConfigModule` (zod), correlation-id middleware, OpenAPI + drift gate.
- **T-0003 — Auth**:
  - `POST /v1/auth/{register,login,refresh,logout}` + `GET /v1/auth/me`; operator variants at `/v1/auth/operator/{login,me}`.
  - argon2id via `hash-wasm`; HS256 access JWT with `aud`; opaque rotating refresh tokens (`refresh_token` table, sha-256 stored, family-based reuse detection).
  - `UserAuthGuard` / `OperatorAuthGuard` enforce audience separation (`wrong_token_audience`).
  - `LoginThrottlerGuard` — 5 attempts / 60s per identifier → 429 `rate_limited`.
  - Migration `20260901192633_auth_refresh_tokens`; `refresh_token` added to `docs/design/data/data-model.md`.
  - 14 tests pass; lint/build/openapi-drift green; live flow verified.

### Environment changes

- Postgres image bumped to `postgres:18-alpine` (native `uuidv7()`); compose volume remounted at `/var/lib/postgresql` for the PG18 layout.
- Host `brew services postgresql@18` stopped; `pos` / `pos_dev` / `pos_shadow` dropped from the host instance.
- `SHADOW_DATABASE_URL` removed from schema and `.env` (Prisma auto-manages the shadow DB); still optional in env validation.
- OpenAPI generator/drift scripts moved from `tsx` (TS) to `node scripts/*.mjs` against `dist/`; `tsx` removed.
- `infra/docker-compose.yml` stack verified healthy (postgres, redis, minio + bucket, mailpit) — satisfies T-0001's compose criterion; T-0009 still owns the app-container additions.

### In Progress

- None.

### Next Focus

- T-0004 — Tenancy: `business` + `membership` models + migration + RLS, `POST /v1/businesses`, `TenantGuard` + `RoleGuard`, `runInTenantContext` (`SET LOCAL app.business_id`), operator 403 on data routes.
