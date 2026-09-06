# T-0402 Owner Winger-Account Endpoints + User Resolve-or-Create + Authorize/Suspend Events

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 05 — Winger Portal

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (Winger section), `docs/design/interfaces/internal-rpc.md` (`identity.getUser`, `tenancy.resolveMembership`), `docs/design/interfaces/events-catalog.md` (`WingerAuthorized`, `WingerSuspended`), `docs/design/data/data-model.md` (`winger_account` invariants), `docs/design/product/roles-and-permissions.md` (winger binds one user to one business)
- Constraints: Owner-only (role gate from the internal context); write the `winger_account` row and the `WingerAuthorized` / `WingerSuspended` outbox record in one tenant transaction; RPC calls use `bus.request` with a 2–3s timeout and map failure to `503 upstream_unavailable`; idempotent authorize (re-authorizing an existing active account is a no-op `200`); contract changes only via `@pos/contracts` (already added in T-0401).
- Do not touch: `services/identity` beyond the `getUser { create }` handler change; `services/tenancy`; `winger_catalog_projection` and its consumers (T-0403); winger catalog endpoints (T-0404); `web/`, `mobile/`.

## Objective

Ship `POST/GET/PATCH /v1/businesses/{businessId}/winger-accounts` (Owner) so an Owner can authorize a reseller by email/phone, list accounts, and suspend/reactivate — emitting `WingerAuthorized` / `WingerSuspended`.

## Scope Boundary

**In scope:**
- `services/identity`: `getUser` RPC handler accepts `create?: boolean`; when `create` is true and no user matches the given `email`/`phone`, insert a passwordless user (`disabled: false`, no credential) and return it. Add the `create` field to the request zod schema in `@pos/contracts` (additive) + a contract test.
- `services/winger`: `WingerAccountsController` + `WingerAccountsService`:
  - `POST /v1/businesses/{businessId}/winger-accounts` — body `{ email? , phone? }` (exactly one). Resolve via `pos.rpc.identity.getUser { email|phone, create: true }`. Call `pos.rpc.tenancy.resolveMembership { business_id, user_id }`; if `found` → `409 conflict` (`code: "already_a_member"`). Upsert `winger_account` `(business_id, user_id)` as `active`. Write `WingerAuthorized` (`portal_url = ${WEB_BASE_URL}/winger`, `email`, `locale` from the resolved user, defaulting `en`) to the outbox in the same txn. Return the account. Re-authorizing an existing `active` account → `200` no-op (no duplicate event).
  - `GET /v1/businesses/{businessId}/winger-accounts` — list `{ id, user_id, email, name, status, created_at }` (email/name from a cached `identity.getUser` per row or a joined projection — no cross-schema DB access).
  - `PATCH /v1/businesses/{businessId}/winger-accounts/{id}` — body `{ status: "active" | "suspended" }`. On transition to `suspended`, write `WingerSuspended` to the outbox; on transition back to `active`, write `WingerAuthorized` again. No-op when status is unchanged.
- Kong: `/v1/businesses/{businessId}/winger-accounts` routed to the `winger` service on the standard business-scoped route with `pos-internal-context` (`require_business_scope: true`) — `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`.
- e2e specs in `services/winger` (InMemoryBus stubs for the two RPCs).

**Out of scope:**
- `/v1/winger/*` reader routes + their Kong route — T-0404.
- Projection consumers — T-0403.
- Web management UI — T-0405; email template — T-0407.

## Acceptance Criteria

- `POST .../winger-accounts` with an unknown `email` returns `201` with `{ id, user_id, status: "active" }` and publishes exactly one `WingerAuthorized` (asserted on the bus).
- `POST .../winger-accounts` for a `user_id` that `tenancy.resolveMembership` reports `found` returns `409` and writes no row and no event.
- `POST .../winger-accounts` twice for the same email publishes `WingerAuthorized` once.
- `PATCH .../winger-accounts/{id}` `{ status: "suspended" }` sets the row and publishes one `WingerSuspended`; a second identical `PATCH` publishes nothing.
- `PATCH .../winger-accounts/{id}` `{ status: "active" }` after a suspend publishes `WingerAuthorized`.
- `GET .../winger-accounts` returns the business's accounts only; a cross-tenant `business_id` yields an empty list (forced RLS).
- With the `identity` RPC unavailable, `POST` returns `503 upstream_unavailable` and writes nothing.
- `identity` `getUser { create: true }` contract test passes; `node scripts/check-contracts-compat.mjs HEAD` → OK.

## Dependencies

- T-0401 (winger scaffold + `winger_account` model + `SUBJECTS.winger` + payloads).

## Implementation Checklist

1. `@pos/contracts`: add `create?` to the `getUser` request schema + test.
2. `services/identity`: `getUser` handler provisions a shell user on `create`.
3. `services/winger`: `WingerAccountsService` — resolve-or-create, mutual-exclusion RPC, upsert, outbox writes.
4. `services/winger`: `WingerAccountsController` — POST/GET/PATCH with Owner gate + zod DTOs.
5. Kong: business-scoped route for `/v1/businesses/{id}/winger-accounts`.
6. e2e specs; `pnpm -r build/test/lint`; `check-contracts-compat.mjs`; validator.

## Verification

Run and capture:

- `pnpm --filter @pos/winger test` — authorize/list/suspend/reactivate specs incl. `409` mutual exclusion, idempotent authorize, `503` on RPC outage.
- `pnpm --filter @pos/identity test` — `getUser { create }` provisioning spec.
- `pnpm --filter @pos/contracts test`; `node scripts/check-contracts-compat.mjs HEAD` → OK.
- Live smoke through Kong (rebuilt `winger` + `identity` containers): `POST /v1/businesses/{id}/winger-accounts` → `GET` → `PATCH` suspend → `PATCH` reactivate; confirm events on `pos.evt.winger.>`.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
