# T-0112 services/identity

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md`, `docs/design/interfaces/internal-rpc.md`, `docs/design/interfaces/events-catalog.md`, `docs/design/interfaces/api-contract.md`, `docs/design/data/data-model.md`
- Constraints: own schema only (`identity` in the shared Postgres, role `identity_app`); no `business_id`; argon2id via `hash-wasm`; token audiences `user` / `operator`; try/catch around hashing + token ops.
- Do not touch: `tenancy`, `gateway` code.

## Objective

`services/identity` owns `user` / `operator` / `refresh_token`, serves auth over HTTP (behind the gateway) and the `getUser` / `verifyToken` RPCs, and emits `UserRegistered`.

## Scope Boundary

**In scope:**
- New NestJS service; `@pos/nest-common` + `@pos/contracts` deps; own Prisma schema + migrations for `user`, `operator`, `refresh_token` (relocated from `api/prisma`).
- Relocate `api/src/auth/*` (password, token, guards, service, controllers) into the service.
- HTTP routes (mounted under `/v1/auth/*` by the gateway): `register`, `login`, `refresh`, `logout`, `me`, `operator/login`, `operator/me`.
- NATS request/reply handlers: `pos.rpc.identity.getUser`, `pos.rpc.identity.verifyToken`.
- Emit `pos.evt.identity.UserRegistered` via the outbox helper.
- `/healthz`, `/readyz` (DB + NATS), Dockerfile, k8s overlay values.

**Out of scope:**
- Password reset (later phase).
- Gateway routing (T-0114).

## Acceptance Criteria

- [ ] `prisma migrate deploy` on `identity_db` creates `user`, `operator`, `refresh_token`.
- [ ] All auth behaviours from Phase 00 (T-0003) pass, run against this service directly: register/login/refresh-rotation+reuse/logout/me/audience-rejection/rate-limit.
- [ ] `getUser` returns `{ user_id, name, email?, phone?, disabled }` or `not_found`; `verifyToken` validates signature + expiry and returns claims.
- [ ] `UserRegistered` is written to the outbox in the same transaction as the user insert and published to JetStream.
- [ ] `/readyz` returns 503 when the DB or NATS is down.

## Dependencies

- T-0110, T-0111, T-0115

## Implementation Checklist

- [ ] Scaffold `services/identity`; wire `@pos/nest-common` bootstrap.
- [ ] Move Prisma schema (identity tables) + migrations; point at `IDENTITY_DATABASE_URL`.
- [ ] Move `auth/*`; adapt imports to `@pos/nest-common`.
- [ ] Add NATS RPC handlers + the `UserRegistered` emit via outbox.
- [ ] Add health, Dockerfile, k8s overlay.
- [ ] Port the T-0003 e2e suite to run against this service.

## Verification

- Command: `pnpm --filter @pos/identity test && pnpm --filter @pos/identity exec prisma migrate deploy`
- Evidence: test report + migration list + a captured `UserRegistered` message from NATS, pasted into the PR.
