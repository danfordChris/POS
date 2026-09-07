# T-0501 Tenancy — Staff Invitations (Create / List / Revoke / Accept)

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (Invitations rows; `410 invitation_expired`), `docs/design/data/data-model.md` (`invitation`), `docs/design/interfaces/events-catalog.md` (`InvitationCreated`, `InvitationAccepted`), `docs/design/architecture/service-decomposition.md` (`tenancy` owns `invitation`), `docs/design/product/prd-mvp.md` (U2, U3)
- Constraints: `services/tenancy` only; `invitation` is a tenant table with forced RLS; token is opaque and unguessable (≥128-bit), only its SHA-256 `token_hash` is stored; `InvitationCreated` goes through the existing outbox + `OutboxRelay`; `@pos/contracts` `invitationCreatedPayload` / `invitationAcceptedPayload` already exist — reuse, no contract change; the accept route is `POST /v1/invitations/accept` with `{ token }` in the body (an authenticated user context), not path-scoped.
- Do not touch: `identity` beyond an existing `getUser` call; other services; `web/`, `mobile/`. The `notifications` `invitation` email is a small add here only if that consumer path is missing.

## Objective

An Owner can invite a Staff member by email and the invitee can accept with the emailed token to gain a Staff `membership`; expired or used tokens are rejected with `410`.

## Scope Boundary

**In scope:**
- Prisma: `invitation` model (`id`, `business_id`, `role` (`staff`), `email`, `token_hash` unique, `status` (`pending|accepted|revoked|expired`), `expires_at`, `created_by`, `created_at`) + migration + forced tenant RLS.
- `POST /v1/businesses/{businessId}/invitations` (Owner) — body `{ email }`; generate token, store hash, `expires_at = now + INVITATION_TTL` (env, default 7d); write `InvitationCreated` (`accept_url = ${WEB_BASE_URL}/invitations/accept?token=…`) to the outbox in the same txn; return `{ id, email, role, expires_at }` (never the token in the list response; the token is only in the event/email).
- `GET /v1/businesses/{businessId}/invitations` (Owner) — list non-secret fields.
- `POST /v1/businesses/{businessId}/invitations/{id}/revoke` (Owner) — `status = revoked`.
- `POST /v1/invitations/accept` (authenticated user) — body `{ token }`; hash, look up a `pending` invitation whose `expires_at` is in the future; on miss/expired/used → `410 invitation_expired` (lazily flip a matched-but-expired row to `expired`); on success create a `membership` (`role: staff`, `status: active`) for the caller's `user_id`, set `status = accepted`, write `InvitationAccepted` + `MembershipCreated` to the outbox (with the member `email` + `locale` fields, resolved via `identity.getUser`, to keep the notifications projection fed).
- Kong: `/v1/invitations/*` route with `pos-internal-context` (`require_business_scope: false`) — `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`.
- `INVITATION_TTL_DAYS` in `services/tenancy` env + `.env.example`.
- `notifications`: if no `invitation`-type path exists, add an `InvitationCreated` consumer → `notification` row → `invitation` email (en/sw), mirroring `winger_authorized` (T-0407). If it already exists, leave it.
- e2e specs in `services/tenancy` (and `notifications` if the email path is added).

**Out of scope:**
- Invitation resend (backlog).
- Web/mobile invite UI (a follow-up; U2/U3 acceptance is API-level).

## Acceptance Criteria

- `POST .../invitations` returns `201` with `{ id, email, role: "staff", expires_at }` and no token field; exactly one `InvitationCreated` is published carrying an `accept_url` with the token.
- `POST /v1/invitations/accept` with that token as a different authenticated user returns `200/201`, creates a `membership` (`role: staff`) for that user, and flips the invitation to `accepted`; a second accept with the same token returns `410 invitation_expired`.
- An invitation past `expires_at` → `POST /v1/invitations/accept` returns `410` and the row's `status` is `expired`.
- A revoked invitation → accept returns `410`.
- `GET .../invitations` returns the business's invitations only (cross-tenant `businessId` → empty; forced RLS).
- `node scripts/check-contracts-compat.mjs HEAD` → OK (no contract change).
- `pnpm --filter @pos/tenancy build/test/lint` green; `kubectl kustomize infra/k8s/base` renders; `kong config parse` OK.

## Dependencies

- None (Phases 00–05 done). `identity.getUser` RPC exists.

## Implementation Checklist

1. Prisma `invitation` model + migration + forced RLS.
2. `InvitationsService` — create (token + hash + outbox), list, revoke, accept (membership + status + outbox).
3. `InvitationsController` — the four routes with the Owner gate / user gate.
4. Kong `/v1/invitations/*` route in both config files.
5. `notifications` `InvitationCreated` → email, only if absent.
6. e2e specs; `pnpm -r build/test/lint`; `kustomize`; `kong config parse`; `check-contracts-compat.mjs`; validator.

## Verification

Run and capture:

- `pnpm --filter @pos/tenancy test` — create/list/revoke/accept incl. `410` on expired / used / revoked, membership creation, RLS scoping.
- `pnpm --filter @pos/notifications test` if the `invitation` email path was added.
- `node scripts/check-contracts-compat.mjs HEAD` → OK; `kubectl kustomize infra/k8s/base`; `kong config parse`.
- Live smoke through Kong: Owner invites `staff2@…`; register `staff2`; `POST /v1/invitations/accept` with the emailed token; `GET /v1/businesses/{id}/members` shows the new Staff row; a second accept → `410`.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
