# T-0110 Monorepo Restructure + Shared Packages

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md`, `docs/design/architecture/system-overview.md`, `docs/design/decisions/0002-microservices.md`
- Constraints: no author attribution in commits; ESM; try/catch around I/O; keep the existing `api/` building until T-0117 deletes it.
- Do not touch: `web/`, `mobile/` source; feature-service logic (later tasks).

## Objective

The pnpm workspace contains `services/` and `packages/` with `@pos/contracts` and `@pos/nest-common` built, and the reusable pieces of `api/` (error envelope, correlation id, config, health, prisma/tenant-context helpers) live in `@pos/nest-common`.

## Scope Boundary

**In scope:**
- `pnpm-workspace.yaml`: `services/*`, `packages/*`, `web`.
- `packages/contracts` (`@pos/contracts`): zod schemas for the internal-context shape + error codes + NATS subject constants; event/RPC payload schemas as stubs matching `events-catalog.md` / `internal-rpc.md`; a `schemaVersion` helper. Build to ESM + d.ts.
- `packages/nest-common` (`@pos/nest-common`): move from `api/src` — `AllExceptionsFilter` + `error-response`, `correlationId` middleware, `ConfigModule` + `env.validation` base, `HealthController` skeleton, `PrismaService` base (`runInTenantContext`, `assertTenantContext`, `TenantContextError`), `enable_tenant_rls` SQL snippet as an exported string, `registerNotFoundFallback`, `configureApp`. Generic (no business models).
- Root `tsconfig.base.json` + project references; `prettier`/`oxlint` config shared.
- Keep `api/` compiling by having it depend on `@pos/nest-common` for the moved pieces (thin re-export shims allowed).

**Out of scope:**
- Any service under `services/` beyond empty package.json + tsconfig placeholders.
- NATS wiring (T-0115), CI (T-0116).

## Acceptance Criteria

- [x] `pnpm install` resolves the workspace with `packages/contracts` and `packages/nest-common` (`workspace:*` linked into `api`).
- [x] `pnpm -r build` builds both packages (ESM + `.d.ts`) with no type errors (exit 0).
- [x] `@pos/contracts` (5) and `@pos/nest-common` (6) tests pass — schema round-trips; the 3 `AllExceptionsFilter` unit tests relocated from `api`; 3 new `TenantContext` tests.
- [x] `api/` builds and `pnpm --filter api test` passes (16, down from 19 — the 3 filter tests moved out), importing envelope / correlation-id / configure-app / not-found / `TenantContext` / `makeEnvValidator` from `@pos/nest-common`.
- [x] `pnpm -r lint` and root `pnpm format:check` clean; `api` OpenAPI drift check in sync.
- Deferred to T-0112: `HealthModule` stays in `api` until the first real service needs `/healthz` + `/readyz` (needs a service-name + db-probe abstraction).

## Dependencies

- Phase 00 (T-0001..T-0004) output.

## Implementation Checklist

- [x] `pnpm-workspace.yaml` → `packages/*`, `services/*`, `web`, `api`; `tsconfig.base.json` added.
- [x] `packages/nest-common` (`@pos/nest-common`): `error-response`, `AllExceptionsFilter` (+ spec), `correlationId`, `registerNotFoundFallback`, `RequestWithContext`, `configureApp`, `buildOpenApiDocument`, `TenantContext` + `TenantContextError` + `ENABLE_TENANT_RLS_SQL`, `makeEnvValidator` + `NestConfigModule`; barrel `index.ts`.
- [x] `packages/contracts` (`@pos/contracts`): `subjects` + `SUBJECTS`, `ERROR_CODES`, `internalContextSchema` + headers, `messageEnvelopeSchema`, event payload stubs, RPC request/response stubs, `SCHEMA_VERSION`; round-trip spec.
- [x] `api/` rewired: `app.factory.ts` re-exports from `@pos/nest-common` + keeps the api-titled `buildOpenApiDocument`; `PrismaService` composes `TenantContext`; `config.module` + `env.validation` use `makeEnvValidator` / `NestConfigModule`; `api/src/common` deleted.
- [x] `AllExceptionsFilter` unit spec relocated to `packages/nest-common`.

## Verification

- `pnpm install` — links `@pos/*` into `api` (exit 0).
- `pnpm -r build` — contracts, nest-common, web, api all Done; `api/openapi.json` regenerated.
- `pnpm -r test` — contracts 5, nest-common 6, api 16 = 27 pass.
- `pnpm -r lint` clean; `pnpm format:check` clean; `pnpm --filter api openapi:check` "in sync".
