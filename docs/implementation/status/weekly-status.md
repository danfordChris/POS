# Weekly Status

## 2026-09-01

### Summary

- Project structured through the workflow contract; design + implementation docs complete.
- Phase 00 started. T-0001 (repo scaffold) done.

### Completed

- `docs/design/` and `docs/implementation/` authored; decision 0001 finalized (NestJS + PostgreSQL + Prisma, containerized hosting, NextSMS deferred).
- Git initialized on `main`; documentation baseline committed.
- **T-0001 — repo scaffold**: pnpm workspace (`api` + `web`) + standalone `mobile` Flutter project + `infra/`.
  - `api/` NestJS 12 (ESM, vitest, oxlint), `GET /health` returns 200.
  - `web/` Next.js 16 + Tailwind 4, placeholder page.
  - `mobile/` Flutter 3.44 (`org tz.co.pos`, `pos_mobile`), placeholder screen.
  - Root tooling: Prettier, Husky + lint-staged, `.editorconfig`, `.nvmrc`, `.env.example`.
  - `infra/docker-compose.yml`: Postgres 16, Redis 7, MinIO (+ bucket), Mailpit — `config` valid.
  - Verified: format:check, api lint/test/build, web lint/build, flutter analyze/test all green.

### In Progress

- None.

### Blockers

- No Docker daemon in the dev session → live `docker compose up` healthcheck deferred to T-0009.

### Next Focus

- T-0002 — API base: Prisma + PostgreSQL wiring, `/v1` prefix, error envelope, OpenAPI generation, real `GET /v1/health` with a DB probe.
- Then T-0003 (auth), T-0004 (tenancy + RLS).
