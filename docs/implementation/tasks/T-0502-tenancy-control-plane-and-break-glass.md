# T-0502 Tenancy — Control-Plane `/v1/admin/*` + Support-Access Grants + Audit Log

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (Control-plane + Owner-side support approval rows; `403 operator_data_access_denied`), `docs/design/architecture/multi-tenancy.md` (Platform operator policy; 24h grant cap; audit_log on each operator read), `docs/design/data/data-model.md` (`support_access_grant`, `audit_log`), `docs/design/architecture/service-decomposition.md` (`tenancy` owns both + serves `/v1/admin/*`), `docs/design/product/prd-mvp.md` (U13)
- Constraints: `services/tenancy` only; `/v1/admin/*` is audience `operator` (the `pos-internal-context` plugin already rejects `operator` tokens on data routes — `/v1/admin/*` needs a route that *accepts* `operator` and forwards `token_kind: operator`); `support_access_grant.expires_at` is capped server-side at `granted_at + 24h`; an operator read of any business's tenant data is allowed **only** when an active (approved, not expired, not revoked) grant exists for `(operator_id, business_id)`, and each such read writes one `audit_log` row; `audit_log` and `support_access_grant` are tenant tables with forced RLS except `audit_log` read is Owner-visible per business and `business_id` may be null for control-plane rows (relax the read policy for a null-scoped control-plane reader, keep WITH CHECK strict — the pattern from `notification`).
- Do not touch: other services; `web/`, `mobile/` (an operator console is out of scope; U13 is API-level). `identity` operator auth (`/v1/auth/operator/*`) already exists.

## Objective

An operator can run the control-plane (`/v1/admin/*`) and request break-glass; an Owner approves/revokes; operator access to tenant data works only under an active grant and is always audited; without a grant it is `403`.

## Scope Boundary

**In scope:**
- Prisma: `support_access_grant` (`id`, `business_id`, `operator_id`, `reason`, `approved_by` nullable, `granted_at`, `expires_at` nullable, `revoked_at` nullable) + `audit_log` (`id`, `business_id` nullable, `actor_id`, `actor_type` (`user|operator|system`), `action`, `target_type`, `target_id` nullable, `metadata` json, `created_at`) + migration + RLS (grant: forced; audit_log: relaxed read for the control-plane/Owner reader, strict WITH CHECK).
- Control-plane controller (audience `operator`): `POST /v1/admin/businesses` (provision a `business` + first-owner `membership`, reusing the existing create path; emits `BusinessCreated`), `GET /v1/admin/businesses` (id, name, `subscription_status`, product + member counts — no row contents), `PATCH /v1/admin/businesses/{id}` (`subscription_status`), `POST /v1/admin/support-grants` (`{ business_id, reason }` → `pending` grant), `GET /v1/admin/support-grants` (the caller operator's own grants).
- Owner controller: `GET /v1/businesses/{businessId}/support-grants`, `POST .../support-grants/{id}/approve` (sets `approved_by`, `granted_at = now`, `expires_at = min(body?, now + 24h)`), `POST .../support-grants/{id}/revoke` (`revoked_at = now`).
- Operator data-access guard: a reusable `OperatorGrantGuard` (or service check) that, for any tenant read initiated by an `operator` context, requires an active grant for `(operator_id, business_id)` and writes an `audit_log` row (`actor_type: operator`, `action`, `target_type`); no active grant → `403 operator_data_access_denied`. Wire it into whichever tenant read routes an operator is ever allowed to reach under a grant (at minimum a read-only `GET /v1/admin/businesses/{id}/detail` that returns row-level tenant data only under a grant; scope the surface explicitly in the task's design read).
- Kong: `/v1/admin/*` route accepting `operator` audience (`pos-internal-context` variant or a dedicated config) in `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`.
- e2e specs.

**Out of scope:**
- A web operator console.
- Grant request notifications / emails (can be a follow-up).

## Acceptance Criteria

- An `operator`-audience token on any `/v1/businesses/{id}/*` data route (catalog/inventory/sales/winger/alert-config) returns `403 operator_data_access_denied` (verified by the isolation suite, T-0503).
- `POST /v1/admin/support-grants` creates a `pending` grant; the target Owner sees it via `GET /v1/businesses/{id}/support-grants`.
- `POST .../support-grants/{id}/approve` with `expires_at` 48h in the body results in a stored `expires_at` ≤ `granted_at + 24h`.
- An operator read of that business's tenant data succeeds **only** while the grant is active and writes exactly one `audit_log` row per read; after `expires_at` or after `/revoke`, the same read returns `403`.
- `GET /v1/admin/businesses` returns no row-level tenant contents (only id/name/status/counts).
- `pnpm --filter @pos/tenancy build/test/lint` green; `kong config parse` OK; `kubectl kustomize infra/k8s/base` renders; `check-contracts-compat.mjs` → OK.

## Dependencies

- T-0501 may share the invitations migration timeline but is otherwise independent. `identity` `/v1/auth/operator/login` exists.

## Implementation Checklist

1. Prisma `support_access_grant` + `audit_log` + migration + RLS.
2. `AdminController` (operator) + `SupportGrantsController` (Owner) + services.
3. `OperatorGrantGuard` + `audit_log` write on operator reads; define the exact grant-gated read surface.
4. Kong `/v1/admin/*` operator-audience route in both config files.
5. e2e specs; `pnpm -r build/test/lint`; `kustomize`; `kong config parse`; validator.

## Verification

Run and capture:

- `pnpm --filter @pos/tenancy test` — control-plane list/patch; grant request → approve (24h cap) → operator read succeeds + `audit_log` row → expire/revoke → `403`; no-grant read → `403`.
- `kong config parse`; `kubectl kustomize infra/k8s/base`; `node scripts/check-contracts-compat.mjs HEAD` → OK.
- Live smoke: operator login; request a grant; Owner approves; operator read writes an `audit_log` row the Owner can see; Owner revokes; operator read → `403`.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
