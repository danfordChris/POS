# Release Checklist — MVP

Run top to bottom. Every box must be checked before tagging a release.

## Pre-flight

- [ ] `main` is green: `packages`, `contracts-compat`, `service (*)`, `edge`,
      `web`, `docs`, and **`acceptance (U1-U13 e2e)`** all passing on the commit
      being released.
- [ ] `node scripts/check-contracts-compat.mjs origin/main` → OK (no removed
      contract keys since the last release).
- [ ] `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py`
      → `WORKFLOW:ok`.
- [ ] `openapi.json` regenerated and committed (no drift) if the OpenAPI job is
      enabled.

## Infrastructure

- [ ] `docker run … kong:3.7 kong config parse infra/kong/kong.yml` → `parse successful`.
- [ ] `kubectl kustomize infra/k8s/base` renders without error.
- [ ] Every service's `*_DATABASE_URL`, `INTERNAL_CONTEXT_SECRET`,
      `JWT_ACCESS_SECRET`, `INTERNAL_API_KEY`, and S3 / SMTP settings are present
      in the target environment's secret store (see `infra/k8s/base/secret.example.yaml`).
- [ ] `INTERNAL_CONTEXT_SECRET` and `JWT_ACCESS_SECRET` are the **same value**
      across Kong and every service.
- [ ] Rate limits active at the edge: `auth-public` 60/min, `receipt-public`
      120/min (T-0506).
- [ ] Kong `cors` plugin `origins` pinned to the real web origin(s) — **not**
      `['*']` (see `docs/ops/security-review-2026-09.md`, finding 1).
- [ ] A **backup was taken and restored** into a throwaway database within the
      last 24h — `bash infra/restore-drill.sh` (or the managed-DB equivalent)
      PASSes (T-0507).

## Deploy

- [ ] Tag the release: `git tag vX.Y.Z && git push --tags`.
- [ ] Roll images (`ghcr.io/pos/<svc>:vX.Y.Z`) to the cluster / compose host.
- [ ] `prisma migrate deploy` for **each** service against its schema, in any
      order (schemas are independent). Confirm `_prisma_migrations` has no
      `applied_steps_count` gaps.
- [ ] `GET /readyz` green for every service; Kong `GET /status` green.
- [ ] Run `bash infra/acceptance-smoke.sh https://<edge-host>` against the
      deployed environment.

## Post-deploy

- [ ] Structured request logs (`{ request_id, business_id, … }`) are flowing to
      the aggregator (T-0508).
- [ ] The uptime monitor is watching every `/readyz` + Kong `/status`.
- [ ] The error-tracking hook is wired (`configureApp({ errorReporter })`) if
      that environment uses one.
- [ ] `docs/implementation/status/weekly-status.md` updated with the release.

## Rollback (if the acceptance smoke fails post-deploy)

1. Re-point images to the previous tag; restart.
2. Only roll a migration back if the new one is **not** backward-compatible with
   the old image — most are additive and safe to leave. If it must go:
   `prisma migrate resolve --rolled-back <name>` then apply the down SQL by hand
   (Prisma has no auto-down); prefer restoring from the pre-deploy backup.
3. Re-run `infra/acceptance-smoke.sh`.

See `docs/ops/runbook.md` for the detailed procedures.
