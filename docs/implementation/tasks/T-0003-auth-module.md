# T-0003 Auth Module

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md`, `docs/design/product/roles-and-permissions.md`, `docs/design/architecture/multi-tenancy.md`
- Constraints: argon2id password hashing; access token ~15 min, rotating refresh ~30 days; token audiences `user` and `operator` are non-interchangeable; try/catch around token + hash operations.
- Do not touch: business/membership models and tenancy guard (T-0004).

## Objective

Users and operators can register (users), log in, refresh, and log out; `GET /v1/auth/me` returns the identity with memberships and winger accounts (empty until T-0004).

## Scope Boundary

**In scope:**
- `POST /v1/auth/register` (user: name, email or phone, password).
- `POST /v1/auth/login`, `/auth/refresh` (rotation + reuse detection), `/auth/logout` (revoke).
- `GET /v1/auth/me`.
- JWT signing/verification with `aud` claim; guards `UserAuthGuard` and `OperatorAuthGuard`.
- Refresh token store (hashed) with revocation.
- Rate limiting on `/auth/*`.

**Out of scope:**
- Membership/role resolution beyond returning empty arrays (T-0004).
- Password reset email flow (later phase).

## Acceptance Criteria

- [ ] `POST /auth/register` with valid body returns 201 and a user; duplicate email/phone returns 409 `conflict`.
- [ ] `POST /auth/login` returns access + refresh tokens; wrong password returns 401 `unauthenticated`.
- [ ] A `user`-audience token on an operator route returns 401 `wrong_token_audience`, and vice versa.
- [ ] `POST /auth/refresh` rotates tokens; reusing a rotated refresh token revokes the chain and returns 401.
- [ ] `GET /auth/me` with a valid token returns the identity, `memberships: []`, `winger_accounts: []`.
- [ ] Passwords stored as argon2id; no plaintext or reversible encoding anywhere.
- [ ] 6+ failed logins within a minute for one identity are rate limited (429 `rate_limited`).

## Dependencies

- T-0002

## Implementation Checklist

- [ ] Add argon2 hashing helper with try/catch and a constant-time compare path.
- [ ] Implement register/login/refresh/logout controllers + services.
- [ ] Implement JWT service with `aud`; add both auth guards.
- [ ] Add hashed refresh-token table + rotation + reuse detection.
- [ ] Add `GET /auth/me`.
- [ ] Add throttler config for `/auth/*`.
- [ ] Contract tests for every row in Acceptance Criteria.

## Verification

- Command: `pnpm --filter api test auth`
- Evidence: passing test report covering register/login/refresh-rotation/audience-rejection/rate-limit, pasted into the PR.
