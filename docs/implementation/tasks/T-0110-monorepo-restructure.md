# T-0110 Monorepo Restructure + Shared Packages

## Status

- `in-progress`
- Last updated: 2026-09-01

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

- [ ] `pnpm install` resolves the workspace with `packages/contracts` and `packages/nest-common`.
- [ ] `pnpm -r build` builds both packages (ESM + `.d.ts`) with no type errors.
- [ ] `pnpm --filter @pos/contracts test` and `pnpm --filter @pos/nest-common test` pass (schema round-trips; filter unit tests moved from `api`).
- [ ] `api/` still builds and `pnpm --filter api test` still passes, importing the moved code from `@pos/nest-common`.
- [ ] `pnpm --filter api lint` and root `pnpm format:check` clean.

## Dependencies

- Phase 00 (T-0001..T-0004) output.

## Implementation Checklist

- [ ] Update `pnpm-workspace.yaml`; add `tsconfig.base.json`.
- [ ] Create `packages/nest-common` package; move generic modules out of `api/src`; export a barrel.
- [ ] Create `packages/contracts` package; add internal-context + error-code + subjects + stub payload schemas with tests.
- [ ] Point `api/` imports at `@pos/nest-common`; keep `api` green.
- [ ] Move the `AllExceptionsFilter` unit spec into `packages/nest-common`.
- [ ] Verify all Acceptance Criteria.

## Verification

- Command: `pnpm install && pnpm -r build && pnpm -r test && pnpm --filter api test`
- Evidence: build + test output for both packages and `api`, pasted into the PR.
