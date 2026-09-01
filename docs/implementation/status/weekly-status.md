# Weekly Status

## 2026-09-01

### Summary

- Design + implementation docs complete. Phase 00 in progress: T-0001 and T-0002 done.

### Completed

- `docs/design/` + `docs/implementation/` authored; decision 0001 finalized.
- Git initialized on `main`; documentation baseline committed.
- **T-0001 — repo scaffold**: pnpm workspace (`api` + `web`) + standalone `mobile` Flutter project + `infra/` compose (Postgres, Redis, MinIO, Mailpit). Root tooling (Prettier, Husky + lint-staged, editorconfig, env example). All lint/test/build green.
- **T-0002 — API base**:
  - Prisma 6 + PostgreSQL; `user` + `operator` models; migration `20260901184921_init` (UUIDv7, timestamptz).
  - `PrismaService` with try/catch lifecycle + `pingDatabase`; app boots even when the DB is down.
  - `GET /v1/health` → 200 `db:up` / 503 `db:down` (verified live + e2e).
  - `AllExceptionsFilter` → `{ error: { code, message, details }, requestId }`; global `ValidationPipe`; not-found fallback returns the envelope.
  - `ConfigModule` with zod env validation; `correlationId` middleware (x-request-id + access log).
  - OpenAPI generated to `api/openapi.json`; `openapi:check` drift gate; Swagger UI at `/v1/docs`.
  - Verified against the host's local PostgreSQL 18 (`pos_dev` / `pos_shadow`).

### In Progress

- None.

### Blockers

- No Docker daemon in the dev session; using host PostgreSQL for local runs. Live `docker compose up` still owned by T-0009.

### Next Focus

- T-0003 — Auth module: register/login/refresh/logout, `GET /v1/auth/me`, argon2id hashing, `user` vs `operator` token audiences, refresh-token rotation, `/auth/*` rate limiting.
- Then T-0004 (tenancy + RLS).
