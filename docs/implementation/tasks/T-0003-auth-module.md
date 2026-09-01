# T-0003 Auth Module

## Status

- `done`
- Last updated: 2026-09-01

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md`, `docs/design/product/roles-and-permissions.md`, `docs/design/architecture/multi-tenancy.md`
- Constraints: argon2id password hashing (via `hash-wasm`, pure JS — swapped from `@node-rs/argon2` which broke the OpenAPI generator and adds a native-build dependency); access token ~15 min, rotating refresh ~30 days; token audiences `user` and `operator` are non-interchangeable; try/catch around token + hash operations.
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

- [x] `POST /v1/auth/register` with a valid body returns 201 and the public user (no `passwordHash`); a duplicate email/phone returns 409 `conflict`; neither email nor phone returns 400 `validation_error`.
- [x] `POST /v1/auth/login` returns `{ accessToken, tokenType, expiresIn, refreshToken }`; a wrong password returns 401 `unauthenticated`.
- [x] An operator-audience token on `GET /v1/auth/me` and a user-audience token on `GET /v1/auth/operator/me` both return 401 `wrong_token_audience`; the matching token returns 200.
- [x] `POST /v1/auth/refresh` rotates the token; reusing a rotated token returns 401 and revokes the whole family (the sibling token is then also rejected).
- [x] `GET /v1/auth/me` with a valid token returns the identity plus `memberships: []` and `wingerAccounts: []`; no token returns 401.
- [x] Passwords stored as argon2id encoded strings (`$argon2id$…`); no plaintext or reversible encoding.
- [x] 6th failed login within 60s for one identity returns 429 `rate_limited` (limit 5/min, keyed on the submitted email/phone).

## Dependencies

- T-0002

## Implementation Checklist

- [x] `src/auth/password.ts` — `hashPassword` / `verifyPassword` (argon2id via `hash-wasm`, OWASP params, `verify` never throws).
- [x] `TokenService` — HS256 access JWT (`sub`, `aud`, `typ`), opaque refresh token (32 bytes, sha-256 stored).
- [x] `AuthService` — register / loginUser / loginOperator / refresh (rotate + family reuse detection) / logout (family revoke) / meForUser / meForOperator.
- [x] `AuthController` (`/v1/auth`) + `OperatorAuthController` (`/v1/auth/operator`).
- [x] `UserAuthGuard` / `OperatorAuthGuard` (explicit constructors so Nest DI resolves inherited deps); `@CurrentUser` / `@CurrentOperator` param decorators.
- [x] `refresh_token` Prisma model + migration `20260901192633_auth_refresh_tokens`; documented in `docs/design/data/data-model.md`.
- [x] `LoginThrottlerGuard` (`@nestjs/throttler`, keyed on identifier) on register + both login routes; `ThrottlerModule` baseline in `AuthModule`.
- [x] Env: `JWT_ACCESS_SECRET` (required), `ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_DAYS` (30) added to `env.validation.ts` + `.env.example`.
- [x] `AllExceptionsFilter` now honours an explicit `code` / `details` on a thrown `HttpException` (enables `wrong_token_audience`).
- [x] `test/auth.e2e-spec.ts` — 8 cases covering every acceptance row.

## Verification

- `pnpm --filter api test` → 3 files, **14 tests pass** (auth e2e ×8, health e2e ×3, filter unit ×3).
- `pnpm --filter api lint` (oxlint) → exit 0. `pnpm --filter api build` → compiles + regenerates `openapi.json` (now 8 paths incl. all `/v1/auth/*`). `pnpm --filter api openapi:check` → "in sync".
- Live (`node dist/main.js` against the compose Postgres):
  - `POST /v1/auth/register` → 201; `POST /v1/auth/login` → `{accessToken,tokenType:"Bearer",expiresIn:900,refreshToken}`.
  - `GET /v1/auth/me` with token → 200 `{id,name,email,…,memberships:[],wingerAccounts:[]}`; without token → 401.
  - `POST /v1/auth/refresh` → new pair; replaying the old refresh token → 401.
- OpenAPI generator/drift scripts moved off `tsx` to `node scripts/*.mjs` against `dist/` (tsx crashed silently on the auth dependency graph); `tsx` devDependency removed.
