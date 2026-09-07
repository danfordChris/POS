# Phase 06 — Hardening and MVP Acceptance

## Status

- `pending`
- Last updated: 2026-09-07

## Objective

Build the two designed-but-unimplemented capabilities the MVP acceptance stories need (staff invitations; operator control-plane + break-glass), then prove tenant isolation, operator restrictions, concurrency safety, and PRD stories U1–U13, and cut the MVP release.

## Scope

- `tenancy` **invitations** — `invitation` model + migration + RLS; `POST/GET /v1/businesses/{id}/invitations` (Owner), `POST /v1/invitations/accept` (authenticated invitee, token in body) → Staff `membership`; `InvitationCreated` via the outbox; expired/used token → `410 invitation_expired`. Unblocks U2, U3. `notifications` already consumes `InvitationCreated` (service-decomposition) — add the `invitation` email path if absent.
- `tenancy` **control-plane + break-glass** — `support_access_grant` + `audit_log` models + migrations; `/v1/admin/businesses` (operator: provision, list id/name/status/counts, set `subscription_status`), `/v1/admin/support-grants` (operator: request, list own); Owner `/v1/businesses/{id}/support-grants` + `/approve` (caps `expires_at` at `granted_at + 24h`) + `/revoke`; an operator read of tenant data succeeds **only** under an active grant and writes an `audit_log` row; no grant → `403 operator_data_access_denied`. Kong routes `/v1/admin/*` with audience `operator`. Unblocks U13 + the control-plane path.
- **Cross-tenant isolation suite** — every `/v1/businesses/{id}/*` data route (catalog, inventory, sales, winger-accounts, alert-config) rejects a signed context whose `business_id` ≠ the path or whose caller is not a member (`403`); every `/v1/winger/*` route rejects a non-winger (`403`). Runs in CI.
- **RLS-only backstop test** — per tenant-owning service, a spec that queries a tenant table with **no** `app.business_id` set (or a foreign id) and asserts zero rows — proving `FORCE ROW LEVEL SECURITY` is the backstop when the app filter is bypassed.
- **Concurrency / no-lost-update test** — N concurrent `POST /v1/businesses/{id}/sales` for one product (through the reserve→commit saga) never drive `on_hand` below zero and never lose a decrement; concurrent `stock-in` movements sum exactly.
- **Rate limiting + abuse guards** — add `rate-limiting` to public `/v1/r/{token}`; confirm `/v1/auth/*` limits; a test that the limit returns `429`. Request-size limiting already global.
- **Per-business export + backup runbook** — Owner `GET /v1/businesses/{id}/export` (products + stock + sales as JSON, RLS-scoped) OR verification of an equivalent; a documented Postgres backup/restore procedure and a check that a restore keeps RLS intact.
- **Observability** — request logs across services carry `request_id` + `business_id`; an error-tracking hook; `/healthz` + `/readyz` wired for uptime in compose + k8s; a smoke asserting a scoped request emits a log line with its `business_id`.
- **Release checklist + runbook + security review** — a release checklist and an ops runbook (deploy, rollback, backup/restore, break-glass); run `/security-review`; record MVP readiness in `weekly-status`; CI runs the full U1–U13 acceptance matrix.

## Features

- `docs/implementation/status/weekly-status.md` updated with MVP readiness.
- Security review pass (`/security-review`).

## Design Notes (gap-fills adopted 2026-09-07)

- `tenancy` owns `support_access_grant` + `audit_log` and serves `/v1/admin/*` (operator) + the Owner support-grant routes; it caps grant `expires_at` at 24h and writes the `audit_log` row on each operator read under a grant (`docs/design/architecture/service-decomposition.md`, `docs/design/architecture/multi-tenancy.md`). Invitations, admin, and support-grant HTTP shapes were already in `docs/design/interfaces/api-contract.md`; `invitation` / `audit_log` / `support_access_grant` columns were already in `docs/design/data/data-model.md`; `InvitationCreated` / `InvitationAccepted` were already in `@pos/contracts` + `events-catalog.md`.

## Tasks

- [x] T-0501 `tenancy` staff invitations (create / list / revoke / accept) + `InvitationCreated` + `invitation` email
- [x] T-0502 `tenancy` control-plane `/v1/admin/*` + `support_access_grant` + `audit_log` + Owner approve/revoke + 24h cap
- [x] T-0503 Cross-tenant isolation suite over every data-plane route (CI)
- [x] T-0504 RLS-only backstop test (app tenant filter bypassed)
- [x] T-0505 Concurrency / no-lost-update test on `on_hand`
- [x] T-0506 Rate limiting on `/v1/r/{token}` + `/v1/auth/*` + a 429 test
- [x] T-0507 Per-business export endpoint + backup/restore runbook
- [x] T-0508 Observability — `request_id` + `business_id` in logs, health/uptime, error hook
- [ ] T-0509 Release checklist + runbook + `/security-review` + U1–U13 CI matrix

## Acceptance Criteria

- [ ] PRD stories U1–U13 each have a passing automated test wired into CI.
- [ ] Isolation suite: every `/v1/businesses/{id}/*` data route returns `403` for a non-member / wrong-business context; every `/v1/winger/*` route returns `403` for a non-winger.
- [ ] RLS-only test: a tenant-table query with no `app.business_id` (or a foreign id) returns zero rows for every tenant-owning service.
- [ ] Operator token on any `/v1/businesses/{id}/*` data route returns `403 operator_data_access_denied`; a read under an active grant succeeds and writes one `audit_log` row; a grant's `expires_at` is never more than 24h after `granted_at`; an expired/revoked grant denies again.
- [ ] `POST /v1/invitations/accept` with a valid token creates a Staff `membership`; an expired or already-used token returns `410 invitation_expired`.
- [ ] Concurrent sales on one product never drive `on_hand` below zero or lose a decrement (asserted under ≥ 20 parallel requests).
- [ ] `/v1/r/{token}` and `/v1/auth/login` return `429` once their rate limit is exceeded.
- [ ] `GET /v1/businesses/{id}/export` returns only that business's rows (Owner-only; RLS-scoped).
- [ ] A scoped request produces a structured log line carrying its `request_id` and `business_id`.
- [ ] `/security-review` reports no open high/critical findings (or each is triaged with a documented decision).
- [ ] `node scripts/check-contracts-compat.mjs HEAD` → OK.

## Blockers

- Phases 00–05 `done` — satisfied.

## Linked Tasks

- `docs/implementation/tasks/T-0501-*.md` … `T-0509-*.md`
