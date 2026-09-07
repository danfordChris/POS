# Ops Runbook — MVP

Umbrella runbook. Deep procedures live in the linked docs.

| Topic | Where |
|---|---|
| Release / rollback checklist | `docs/ops/release-checklist.md` |
| Backup & restore, observability, uptime | `docs/ops/backup-restore-runbook.md` |
| Security review (2026-09) | `docs/ops/security-review-2026-09.md` |
| Tenant isolation model | `docs/design/architecture/multi-tenancy.md` |
| Acceptance story → test map | `docs/implementation/status/acceptance-map.md` |
| RLS policy matrix | `docs/implementation/status/rls-policy-matrix.md` |

## Architecture at a glance

Kong edge → `identity`, `tenancy`, `catalog`, `inventory`, `sales`, `winger`,
`notifications`. One PostgreSQL instance, one schema + one non-superuser role per
service, `FORCE ROW LEVEL SECURITY` on every tenant table. NATS (JetStream) for
events + request/reply. Object storage (S3-compatible) for product images.

## Deploy

**Local (compose):**

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d --build
for d in identity tenancy catalog inventory sales winger notifications; do
  docker compose -f infra/docker-compose.yml exec -T "$d" pnpm exec prisma migrate deploy
done
bash infra/acceptance-smoke.sh
```

**Kubernetes:** `kubectl apply -k infra/k8s/base` (after substituting the real
Secret for `secret.example.yaml`). Then run `prisma migrate deploy` per service
(a one-shot Job or `kubectl exec`). Order does not matter — schemas are
independent.

## Migrations

- Each service owns its own migrations under `services/<svc>/prisma/migrations`.
- Apply with `prisma migrate deploy` (never `migrate dev` in a deployed env).
- Migrations are additive by policy; a breaking change uses a new event subject
  `…V2` with a deprecation window, so an old image keeps working against a new
  schema during a rolling deploy.
- No auto-down. To undo: `prisma migrate resolve --rolled-back <name>` + hand-run
  the reverse SQL, or restore from backup.

## Rollback

1. Re-point every service image to the previous tag; restart.
2. Leave additive migrations in place. Roll a migration back only if it broke
   backward compatibility (rare) — prefer a point-in-time restore.
3. `bash infra/acceptance-smoke.sh https://<edge-host>` to confirm.

## Backup & restore

See `docs/ops/backup-restore-runbook.md`. Summary: `pg_dumpall --roles-only` +
`pg_dump -Fc` daily; restore preserves object ownership (schema → `*_app` role)
and RLS policies; verify with `infra/restore-drill.sh` (roles non-superuser,
`FORCE RLS` on tenant tables, a scoped role reads 0 rows unscoped).

## Break-glass operator access

An operator token is rejected (`403 operator_data_access_denied`) on every
`/v1/businesses/{id}/*` route. To read a tenant's data for support:

1. Operator: `POST /v1/admin/support-grants { business_id, reason }` → a
   `pending` grant.
2. The business Owner: `GET /v1/businesses/{id}/support-grants`, then
   `POST .../support-grants/{grantId}/approve` (server caps `expires_at` at
   `granted_at + 24h`).
3. Operator: `GET /v1/admin/businesses/{id}/detail` now returns the row-level
   data **and writes an `audit_log` row** the Owner can see at
   `GET /v1/businesses/{id}/audit-log`.
4. Access ends at `expires_at` or when the Owner calls
   `POST .../support-grants/{grantId}/revoke` — after which the operator read is
   `403` again.

## Incident basics

- **A service is unhealthy**: check `GET /readyz` (includes a DB ping) and
  `docker compose logs <svc>` / `kubectl logs`. Structured `HTTP` log lines carry
  `request_id` + `business_id` — pivot on those.
- **Edge is down**: Kong `GET :8001/status`. A bad `kong.yml` keeps the last good
  config on reload — check `kong config parse` before shipping.
- **NATS backlog**: consumers are idempotent on `event_id` and DLQ after
  max-deliver (`pos.dlq.<ctx>.<Event>`); drain the DLQ once the poison cause is
  fixed.
- **Suspected cross-tenant leak**: run the isolation + rls-backstop specs
  (`services/*/test/{isolation,rls-backstop}.e2e-spec.ts`) against the affected
  environment's database.

## Uptime checks

Point the monitor at each service's `GET /readyz` and Kong `GET :8001/status`
on a 30–60s interval. `/healthz` is liveness only; `/readyz` also pings the DB.
