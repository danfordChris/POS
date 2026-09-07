# T-0501 Tenancy — Staff Invitations (Create / List / Revoke / Accept)

## Status

- `done`
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

Delivered:

- `@pos/contracts` (additive): `invitationCreatedPayload` gains `business_name?`
  + `locale?`; new `invitationAcceptedPayload` (`business_id`, `invitation_id`,
  `user_id`) + `EVENT_PAYLOADS.InvitationAccepted` + round-trip tests. No
  `SCHEMA_VERSION` change; `check-contracts-compat` OK.
- `services/tenancy`: `invitation` model + migration `20260908140000_invitations`
  (unique `token_hash`, forced RLS with a **relaxed read** path so the
  by-`token_hash` accept lookup works with no business context; `WITH CHECK`
  strict). `InvitationsService`:
  - `create` (Owner) — opaque `randomBytes(24).base64url` token, only its SHA-256
    stored; `expires_at = now + INVITATION_TTL_DAYS` (env, default 7);
    `InvitationCreated` to the outbox (`accept_url =
    ${WEB_BASE_URL}/invitations/accept?token=…`, `business_name` + `locale` from
    the business row); response has no token.
  - `list` / `revoke` (Owner).
  - `accept` (authenticated user) — hash, unscoped lookup, `410
    invitation_expired` for missing / accepted / revoked / past-`expires_at`
    (lazily flips a matched-but-expired row to `expired`); re-checks under the
    tenant lock, creates a Staff `membership` (P2002 → `409 already_a_member`),
    flips to `accepted`, writes `MembershipCreated` (with `email` + `locale` from
    `identity.getUser`) + `InvitationAccepted` to the outbox.
  - `InvitationsController` — `POST/GET /v1/businesses/{id}/invitations`,
    `POST .../invitations/{id}/revoke` (Owner, `TenantGuard` + `RolesGuard`);
    `POST /v1/invitations/accept` (`InternalContextGuard` only).
  - env `WEB_BASE_URL` + `INVITATION_TTL_DAYS`; compose + `.env.example`.
- Kong: `invitations` route (`/v1/invitations`, `require_business_scope: false`)
  in `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`.
- `services/notifications`: `InvitationConsumer` (`tenancy.InvitationCreated`,
  `subscribeWithDlq`, idempotent on `event_id`, deduped on `invitation_id`) →
  `InvitationEmailService` → `notification` row (`type: 'invitation'`) + a
  transactional `invitation` email (en/sw templates via
  `TemplateRegistry.renderInvitation`). `InvitationsModule` wired into
  `app.module.ts`.

Evidence:

- `pnpm --filter @pos/tenancy test` → 15 (invitations spec +6: create w/o token +
  event carries one; Staff `403`; accept → Staff membership + second accept
  `410`; expired → `410` + row `expired`; revoked → `410`; list is
  business-scoped).
- `pnpm --filter @pos/notifications test` → 31 (`template-registry` invitation
  en/sw + fallback; `invitation-email.e2e` +3: one localized email + `sent` row;
  idempotent on `event_id` + `invitation_id`; unknown locale → English).
- `pnpm --filter @pos/contracts test` → 13; `node scripts/check-contracts-compat.mjs HEAD` → OK.
- Backend suites green: contracts 13, nest-common 16, testing 5, identity 8,
  tenancy 15, catalog 11, inventory 24, sales 20, winger 24, notifications 31.
- `kubectl kustomize infra/k8s/base` renders; `docker compose config` valid;
  `kong config parse` → `parse successful`.
- Live smoke through Kong: Owner invites `staff2@…`; register `staff2`;
  `POST /v1/invitations/accept` with the emailed token → Staff membership;
  `GET /v1/businesses/{id}/members` shows it; a second accept → `410`; Mailpit
  captured the invitation email with the accept link.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
