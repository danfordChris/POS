# Backup & Restore Runbook

The platform runs **one PostgreSQL instance**, one schema + one non-superuser
`LOGIN` role per service (`identity`, `tenancy`, `catalog`, `inventory`, `sales`,
`winger`, `notifications`), with `FORCE ROW LEVEL SECURITY` on every tenant table.
A backup / restore must preserve **all of that** — schemas, data, roles, and the
RLS policies — or tenant isolation breaks after a restore.

## What to back up

| Item | How | Notes |
|---|---|---|
| Roles (`*_app`, `pos`) | `pg_dumpall --roles-only` | cluster-level; not in a per-database dump |
| The database (all schemas, tables, policies, functions) | `pg_dump -Fc <db>` | custom format → parallel restore, selective restore |

RLS **policies** and the `enable_tenant_rls()` function are schema objects and are
included by `pg_dump`. `FORCE ROW LEVEL SECURITY` is a table attribute — also
included. Nothing extra to capture.

## Backup (run on a schedule)

```bash
# Roles first (idempotent; safe to keep re-applying).
pg_dumpall -h "$PGHOST" -U "$PGSUPERUSER" --roles-only > roles.sql

# Then the database.
pg_dump -h "$PGHOST" -U "$PGSUPERUSER" -Fc -d "$PGDATABASE" > pos.dump
```

- **Frequency**: at least daily; hourly once transaction volume warrants it.
  In a managed environment prefer the provider's continuous / PITR backups and
  treat the `pg_dump` above as the portable, provider-independent copy.
- **Retention**: keep 30 daily dumps; promote one per week to 12-week retention.
- **Storage**: encrypted object storage in a different failure domain from the
  database. Never on the database host.
- **Verify**: run the restore drill (below) against every backup you would rely
  on — a dump you have never restored is not a backup.

## Restore

```bash
# 1. Roles (into the target cluster).
psql -h "$PGHOST" -U "$PGSUPERUSER" -f roles.sql

# 2. Create the target database owned by the bootstrap superuser.
createdb -h "$PGHOST" -U "$PGSUPERUSER" "$TARGET_DB"

# 3. Restore. --no-owner is NOT used: object ownership (schema → *_app role) is
#    part of the isolation model and must be preserved.
pg_restore -h "$PGHOST" -U "$PGSUPERUSER" -d "$TARGET_DB" -j 4 pos.dump

# 4. Point each service's *_DATABASE_URL at $TARGET_DB and run
#    `prisma migrate deploy` per service to apply any migrations newer than the dump.
```

## Post-restore verification (must pass before cutover)

1. **Roles** exist and are non-superuser:

   ```sql
   SELECT rolname, rolsuper FROM pg_roles WHERE rolname LIKE '%\_app';
   -- every row: rolsuper = false
   ```

2. **FORCE RLS** is on for every tenant table (spot-check a few per schema):

   ```sql
   SELECT n.nspname, c.relname, c.relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relname IN ('product','stock_item','sale','winger_catalog_projection',
                       'membership','notification_contact')
   ORDER BY 1;
   -- every row: relforcerowsecurity = true
   ```

3. **A scoped query still isolates.** Connect as a service role (e.g.
   `catalog_app`) and confirm a read with no tenant context returns nothing from
   a strict table:

   ```sql
   SET ROLE catalog_app;
   SELECT count(*) FROM catalog.product;   -- expect 0 (RLS, no app.business_id)
   RESET ROLE;
   ```

4. Each service's `/readyz` is green against the restored database.

`infra/restore-drill.sh` automates 1–3 against a throwaway database.

## Observability & uptime checks

- **Health**: every service serves `GET /healthz` (liveness) and `GET /readyz`
  (readiness — includes a DB ping). Wired as compose `healthcheck`s and k8s
  `livenessProbe` / `readinessProbe`. Kong exposes `GET /status` on its admin
  listener. Point the uptime monitor at each service's `/readyz` (or Kong
  `/status` for an edge-only check) on a 30–60s interval.
- **Request logs**: `@pos/nest-common`'s `correlationId` middleware emits one
  structured JSON line per request on the `HTTP` logger:
  `{ request_id, method, path, status, duration_ms, business_id? }`. `business_id`
  is present only when the request carried a signed internal context. Ship these
  to the log aggregator and index on `request_id` + `business_id`.
- **Error tracking**: unhandled 5xx errors go through
  `AllExceptionsFilter` → an injectable `ErrorReporter` (default no-op). To turn
  it on, a service's `main.ts` builds its own client and passes it:
  `configureApp(app, { errorReporter })`. The `ErrorReporter` receives
  `{ requestId, method, path, businessId }` alongside the error.

## Per-business export (not a backup)

`GET /settings/export` in the web app (Owner only) downloads one business's
products / categories / stock / sales-with-lines / reseller accounts as JSON. It
is built from the normal tenant-scoped read endpoints (RLS enforced) and is for
data portability, not disaster recovery. It is bounded (2000 products, 1000
sales) — a larger business needs a database-level export.
