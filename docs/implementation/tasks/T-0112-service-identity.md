# T-0112 services/identity

## Status

- `done`
- Last updated: 2026-09-02

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

- [x] `prisma migrate deploy` on the `identity` schema (`IDENTITY_DATABASE_URL`, role `identity_app`) creates `user`, `operator`, `refresh_token`, `outbox`, `processed_events`.
- [x] All Phase 00 (T-0003) auth behaviours pass against this service directly — 7 e2e: register 201 / dup 409 / no-contact 400, login + `me` + refresh rotation+reuse + logout, `user`↔`operator` audience rejection, 429 rate limit.
- [x] `getUser` returns `{ found:true, user_id, name, email, phone, disabled }` or `{ found:false }`; `verifyToken` returns `{ valid:true, sub, aud, typ }` or `{ valid:false }` — both over the `MessageBus` (tested via `InMemoryBus`; runtime uses `NatsCoreBus` core request/reply).
- [x] `UserRegistered` is written to `outbox` in the same `$transaction` as the `user` insert; `OutboxRelay` publishes it (live: 24/25 rows `sent_at` set against the running NATS container).
- [x] `/healthz` → 200 always; `/readyz` runs the `db` check and returns 503 when it fails (checks array in the body). NATS readiness check deferred (needs a `NatsCoreBus.healthy()` — follow-up).

## Dependencies

- T-0110, T-0111, T-0115

## Implementation Checklist

- [x] `services/identity` NestJS package (`@pos/identity`); `main.ts` uses `configureApp`/`buildOpenApiDocument`/`registerNotFoundFallback` from `@pos/nest-common`.
- [x] Prisma schema in the `identity` schema (`user`, `operator`, `refresh_token`, `outbox`, `processed_events`); migration `20260901213424_init` applied.
- [x] `auth/*` relocated (password, token, guards, dtos, service, controllers); `AuthService.registerUser` now wraps insert + `OutboxWriter.write` in one `$transaction`; `findUserForRpc` added.
- [x] `IdentityRpc` registers `getUser` / `verifyToken` on `MESSAGE_BUS`; `PlatformModule` wires the real `NatsModule.forRootAsync`; `OutboxRelayService` runs the relay (skips the timer under `NODE_ENV=test`).
- [x] `HealthModule.forRootAsync` from `@pos/nest-common` (new generic module — the deferred T-0110 item); `Dockerfile` (multi-stage, `pnpm deploy`); k8s `identity.yaml` already in `infra/k8s/base` from T-0111.
- [x] `test/identity.e2e-spec.ts` — auth parity + outbox + RPC.
- [x] Multi-Prisma-client fix: each Prisma package now has `generator.output = "../generated/prisma"` and imports via the `#prisma` package subpath (`api` + `identity`) so the two schemas no longer overwrite one shared client.

## Verification

- `pnpm -r test` → contracts 5, testing 5, nest-common 15, api 16, **identity 7** = 48 pass.
- `pnpm -r build` + `pnpm -r lint` + `pnpm format:check` clean.
- `prisma migrate deploy` on the `identity` schema applies `20260901213424_init`.
- Live (`node dist/main.js` on :3001): `/healthz` 200; `/readyz` 200 `{checks:[{name:"db",ok:true}]}`; `POST /v1/auth/register` 201; `POST /v1/auth/login` returns tokens; startup logs "outbox relay started" + "RPC handlers registered"; `outbox` rows drain to `sent_at` via NATS.
