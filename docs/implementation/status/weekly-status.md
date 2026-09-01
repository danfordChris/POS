# Weekly Status

## 2026-09-01

### Summary

- Phase 00 (monolith baseline): T-0001–T-0004 done and committed.
- **Architecture pivot**: decision 0002 adopts microservices (Option B). Design layer rewritten; implementation re-planned around a new Phase 01 — Platform; feature phases renumbered 02–06.

### Completed

- T-0001 scaffold · T-0002 API base · T-0003 auth · T-0004 tenancy + RLS — working monolith `api` on the compose stack (19 tests pass).
- Design docs for microservices:
  - `decisions/0002-microservices.md`; `architecture/system-overview.md` rewritten; `architecture/service-decomposition.md` (new — 8 services, context map, transport, data, deployment, code-relocation map).
  - `architecture/multi-tenancy.md` updated (5 layers incl. gateway edge auth + signed internal context; per-service RLS).
  - `interfaces/events-catalog.md` + `interfaces/internal-rpc.md` (new); `interfaces/api-contract.md` reframed as the gateway contract; `integrations/README.md` adds NATS + Kubernetes.
- Implementation re-plan: `project.md`, `phases/phase-01-platform.md` (new, T-0110–T-0117), phases 02–06 renumbered, T-0005–T-0009 marked superseded/blocked with mapping to Phase 01.

### In Progress

- Phase 01 — Platform. **T-0110, T-0115, T-0111, T-0112 done** (2026-09-02): monorepo restructured; `@pos/contracts`, `@pos/nest-common`, `@pos/testing` built + tested; `api` rewired. T-0115 adds the transactional outbox (`OutboxWriter`/`OutboxRelay`), `runIdempotent`, `subscribeWithDlq`, `MessageBus` + `NatsCoreBus` + `NatsModule`, and the `InMemoryBus` test double. 41 tests across the workspace. T-0111 adds NATS (JetStream) + 7 service schemas/roles (isolation verified) + `infra/k8s/base` (renders clean). **T-0112**: `services/identity` live — auth relocated to the `identity` schema, `getUser`/`verifyToken` RPC, `UserRegistered` via outbox, `HealthModule` added to `@pos/nest-common`, Dockerfile. Multi-Prisma-client isolation fixed via `generator.output` + `#prisma` subpath. 48 tests.

### Blockers

- None. Decision-0002 defaults confirmed 2026-09-01.

### Next Focus

- Then T-0112 `identity`, T-0113 `tenancy`, T-0114 `gateway`; parity suite; delete `api/`.
