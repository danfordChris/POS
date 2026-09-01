# Add a Service to CI

Run right after [scaffold-service](scaffold-service.md). Design: T-0116
(`docs/implementation/tasks/T-0116-per-service-ci.md`).

## Target shape (per T-0116)

CI is a matrix over `services/*` and `packages/*` with a changed-path filter,
plus always-run `contracts` and `docs` jobs:

- **per service**: `pnpm --filter @pos/<svc> lint` → `test` (against ephemeral Postgres + NATS service containers, one schema per service) → `build` → `docker build` on a clean checkout.
- **contracts**: schema diff vs. the base branch — a removed/renamed event or RPC field fails.
- **docs**: `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py`.

## Steps

### If the CI workflow exists

1. Add `<svc>` to the job matrix and the changed-path filter (`services/<svc>/**`, plus `packages/**` fan-out).
2. Add a Postgres schema + role bootstrap for `<svc>` to the CI test-DB init (mirror `infra/postgres/initdb/20-service-schemas.sql`).
3. Add the `<svc>` `docker build` job (multi-stage Dockerfile, clean checkout).
4. Confirm `<SVC>_DATABASE_URL` + `NATS_URL` are set for the `<svc>` test job.

### If it does not exist yet

Leave a checkbox on T-0116's checklist naming `<svc>`, and make sure
`services/<svc>/package.json` exposes the standard scripts (`lint`, `test`,
`build`, `migrate:deploy`) so the matrix picks it up unchanged when T-0116 lands.

### Always

- Multi-stage `services/<svc>/Dockerfile` producing `/healthz` + `/readyz`, graceful NATS drain on shutdown (per `service-decomposition.md` Deployment).
- No author/tool attribution in any pipeline commit.

## Verification

- A PR touching only `services/<svc>` runs the `<svc>` job (+ `contracts` + `docs`), not the whole matrix.
- Lint / test / build / `docker build` failure in `<svc>` fails its job.
- `pnpm --filter @pos/<svc> build && docker build services/<svc>` green on a clean checkout locally.

## Checklist

- [ ] `<svc>` in the CI matrix + path filter (or a named checkbox on T-0116)
- [ ] CI test DB has the `<svc>` schema + role
- [ ] `services/<svc>/Dockerfile` (multi-stage, healthz/readyz, graceful shutdown)
- [ ] `docker build` job for `<svc>`
- [ ] Standard package scripts present so the matrix needs no per-service special-casing
