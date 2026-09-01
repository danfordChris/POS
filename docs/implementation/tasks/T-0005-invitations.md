# T-0005 Invitations: Create / Revoke / Accept + Email

## Status

- `blocked`
- Last updated: 2026-09-01

> **Superseded.** Superseded by decision 0002 (microservices). Invitations move into `services/tenancy`; re-scope as a task under Phase 01/02 before starting.

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md`, `docs/design/integrations/notifications.md`, `docs/design/data/data-model.md`
- Constraints: invitation tokens stored hashed, single-use, expiring; email via `EmailSender` only (local capture in dev); try/catch around token gen, hashing, and send.
- Do not touch: catalog/stock/sales modules; SMS.

## Objective

An Owner can invite a Staff member by email, the invitee can accept once before expiry to gain a Staff membership, and the Owner can revoke a pending invitation.

## Scope Boundary

**In scope:**
- `invitation` model + migration + RLS.
- `POST /v1/businesses/{businessId}/invitations` (Owner) — email, role fixed `staff`, returns id + expiry (not the raw token).
- `GET /v1/businesses/{businessId}/invitations` (Owner) — pending + historical.
- `POST /v1/businesses/{businessId}/invitations/{id}/revoke` (Owner).
- `POST /v1/invitations/accept` (authenticated) — body `{ token }`; creates `membership(role=staff)`; marks invitation `accepted`.
- `invitation` email template (en/sw) with accept URL + expiry, queued via notifications pipeline.
- Expiry sweep: lazily mark `expired` on read/accept when past `expires_at`.

**Out of scope:**
- Inviting Owners or Wingers (winger flow is Phase 04).
- Resend endpoint (backlog).

## Acceptance Criteria

- [ ] `POST .../invitations` returns 201 with `{ id, email, expires_at }` and no raw token in the body.
- [ ] The generated email (captured locally) contains an accept URL whose token validates.
- [ ] `POST /v1/invitations/accept` with a valid token creates exactly one `membership` with `role=staff` and marks the invitation `accepted`.
- [ ] Re-using an accepted token returns 410 `invitation_expired`; using a token past `expires_at` returns 410.
- [ ] A revoked invitation's token returns 410 on accept.
- [ ] Accepting an invitation for a business the caller is already a member of returns 409 `conflict`.
- [ ] Non-Owner calling create/list/revoke returns 403 `role_forbidden`.

## Dependencies

- T-0003, T-0004

## Implementation Checklist

- [ ] Add `invitation` model per `data-model.md`; migration with RLS.
- [ ] Token helper: random 256-bit, store `token_hash`, return raw once to the email layer only.
- [ ] Implement create / list / revoke controllers (Owner-guarded).
- [ ] Implement `POST /v1/invitations/accept`.
- [ ] Add `invitation` email template (en/sw) + enqueue on create.
- [ ] Lazy expiry handling on read and accept.
- [ ] Contract tests for every Acceptance Criteria row.

## Verification

- Command: `pnpm --filter api test invitations`
- Evidence: test report covering create/accept/expiry/revoke/duplicate-member/role-guard, plus a captured invitation email, pasted into the PR.
