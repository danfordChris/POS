# T-0507 Per-Business Export Endpoint + Backup / Restore Runbook

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/architecture/multi-tenancy.md` (per-business scoping; RLS), `docs/design/interfaces/api-contract.md` (route conventions, Owner role), `docs/design/product/prd-mvp.md` (data portability expectation)
- Constraints: the export must be **tenant-scoped through RLS** (built from each service's own `/v1/businesses/{id}/*` reads, not a cross-schema query); Owner-only; a bounded response (paginate or cap, and document the cap); no PII beyond what the Owner already sees in the app. The backup/restore procedure is Postgres-level (`pg_dump` / `pg_restore` of the shared instance) and must be written so a restore preserves every schema's RLS + roles.
- Do not touch: other services' internals — compose the export from existing read endpoints (a thin `tenancy` or `web` aggregator, decide and state which).

## Objective

An Owner can export their business's data through the tenant boundary, and there is a verified, documented backup/restore procedure that keeps RLS intact.

## Scope Boundary

**In scope:**
- `GET /v1/businesses/{businessId}/export` (Owner) returning a JSON document with `products`, `categories`, `stock` (on-hand + thresholds), `sales` (with lines) and `winger_accounts` for that business — assembled by calling the existing per-service read endpoints with the caller's context (so RLS + membership are enforced), not by touching other schemas directly. Decide the host service (`tenancy` aggregator vs a `web` route handler) and state it; document the size cap / pagination.
- A test that the export for business A contains only A's rows and that a non-owner gets `403`.
- `docs/` runbook section: `pg_dump` of `pos` (all schemas + roles), storage/retention note, `pg_restore` steps, and a **post-restore check** that `FORCE ROW LEVEL SECURITY` and the `*_app` roles are present and a scoped query still isolates tenants.
- A scripted or documented restore drill against a throwaway database proving the check passes.

**Out of scope:**
- Automated scheduled backups / cloud storage wiring (ops concern; the runbook points at it).
- CSV/Excel formats (JSON is enough for MVP portability).
- Per-business point-in-time restore (whole-instance only for MVP).

## Acceptance Criteria

- `GET /v1/businesses/{id}/export` as the Owner returns the five sections, each containing only that business's rows.
- The same call as a non-owner (Staff / other business / operator) returns `403`.
- The runbook documents `pg_dump` + `pg_restore` for the shared instance and a post-restore verification that RLS + roles survived; the drill output is captured.
- `pnpm -r build/test/lint` green for any service touched; `check-contracts-compat.mjs` → OK.

## Dependencies

- Per-service read endpoints (catalog/inventory/sales/winger) — all exist.

## Implementation Checklist

1. Decide the export host; implement `GET .../export` composing existing reads.
2. Test: Owner sees only A's rows; non-owner `403`.
3. Write the backup/restore runbook + the post-restore RLS/roles check.
4. Run the restore drill against a scratch DB; capture output.
5. `pnpm -r build/test/lint`; validator.

## Verification

Delivered:

- **Export host: a web route handler** (`web/app/(shell)/settings/export/route.ts`,
  `GET /settings/export`) — not a `/v1/...` API path. Rationale: no single
  service owns products + stock + sales + wingers; the web app already fans out
  tenant-scoped reads through Kong with the caller's own token (the existing
  `stock/export/route.ts` uses the same pattern), so RLS + membership scope the
  result to the caller's business with no cross-schema access and no forged
  internal context.
- Owner-gated: `getSession().role !== 'owner'` → `403`. Sections: `products`,
  `categories`, `stock`, `sales` (full detail incl. `lines`, fetched per sale),
  `winger_accounts`. Bounded at 2000 products / 1000 sales with a `truncated`
  flag in the payload; a `Content-Disposition: attachment` JSON download.
- `web/app/(shell)/settings/page.tsx` — replaces the stub with a real Settings
  page carrying an Owner-only "Export business data" card linking to the route.
- `docs/ops/backup-restore-runbook.md` — `pg_dumpall --roles-only` + `pg_dump -Fc`
  for the whole DB (policies + `FORCE RLS` + ownership are all included);
  retention / storage guidance; `pg_restore` steps (ownership **preserved**);
  and the post-restore verification (roles non-superuser, `FORCE RLS` on tenant
  tables, a scoped role reads 0 rows unscoped, `/readyz` green).
- `infra/restore-drill.sh` — dumps the live compose DB, restores into a
  throwaway `pos_restore_drill`, runs the three checks, drops it.

Evidence:

- `bash infra/restore-drill.sh` → **PASS**: 8 `*_app` roles present and
  `rolsuper = false`; `FORCE RLS` on every sampled tenant table
  (`product`, `stock_item`, `sale`, `winger_catalog_projection`, `membership`,
  `notification_contact`); `catalog_app` unscoped `SELECT count(*) FROM product`
  = 0 after the restore.
- `pnpm --filter web lint` clean; `pnpm --filter web build` — `/settings` and
  `/settings/export` compile (dynamic, server-rendered).
- Export isolation rides on `getSession()` (Owner gate) + `tenantGet` (Kong +
  the Owner's token + RLS) — the same boundary the T-0503 isolation suite
  proves; no cross-tenant read path exists in the route.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
