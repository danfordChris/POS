# T-0002 API Base: NestJS + Prisma + Postgres

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/system-overview.md`, `docs/design/data/data-model.md`, `docs/design/interfaces/api-contract.md`
- Constraints: REST + OpenAPI 3.1 generated from code; JSON error envelope per `api-contract.md`; try/catch around DB and external calls.
- Do not touch: auth logic (T-0003), tenancy guard/RLS (T-0004).

## Objective

The API connects to PostgreSQL via Prisma, runs migrations, exposes `/v1` with the standard error filter and generated OpenAPI, and serves a real `GET /health`.

## Scope Boundary

**In scope:**
- Prisma setup; initial migration with `user` and `operator` tables only.
- Global exception filter producing `{ error: { code, message, details } }`.
- Global validation pipe; config module reading `.env`.
- OpenAPI document generation to `api/openapi.json` + a script to check drift.
- `GET /v1/health` returning DB connectivity status.
- Request logging middleware with a correlation id.

**Out of scope:**
- Business/membership tables and RLS (T-0004).
- Any auth endpoints (T-0003).

## Acceptance Criteria

- [ ] `prisma migrate deploy` on a fresh DB creates `user` and `operator` tables.
- [ ] `GET /v1/health` returns 200 with `{ db: "up" }` when Postgres is reachable, 503 `{ db: "down" }` when not.
- [ ] A thrown `ValidationError` yields HTTP 400 with `error.code = "validation_error"` and a `details` array.
- [ ] `api/openapi.json` regenerated in the build; drift fails the check script.
- [ ] Every DB call path is wrapped so a connection error returns a 5xx envelope, never an unhandled rejection.

## Dependencies

- T-0001

## Implementation Checklist

- [ ] Add Prisma, datasource, and client; wire a `PrismaService` with connect/disconnect lifecycle.
- [ ] Define `user` and `operator` models per `data-model.md`; create the initial migration.
- [ ] Implement the global exception filter and validation pipe.
- [ ] Add config module + schema validation for env vars.
- [ ] Implement `GET /v1/health` with a `SELECT 1` probe in try/catch.
- [ ] Set up OpenAPI generation + `scripts/check-openapi-drift`.
- [ ] Add correlation-id + structured request logging.

## Verification

- Command: `pnpm --filter api test && pnpm --filter api exec prisma migrate deploy && curl -i localhost:3000/v1/health`
- Evidence: test output, migration list, and both `/health` responses (DB up and DB stopped) in the PR.
