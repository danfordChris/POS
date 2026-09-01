# Service Architecture — Microservice Direction

## Status

proposed

## Context

- Current approved design (`docs/design/architecture/system-overview.md`): a single NestJS `api` (modular monolith), one shared PostgreSQL, tenant isolation via `business_id` + RLS. Shipped through T-0004.
- New request: use microservices; split services so the system scales easily later.
- This is an architecture change → it must be resolved here and adopted into `docs/design/` before implementation changes. Phase 00 (T-0001..T-0004) already built against the monolith; T-0005+ are not yet started.

## Problem

- "Microservices" spans a wide range. Committing to full service decomposition now adds real cost to a pre-revenue MVP: a message broker, per-service datastores, cross-service transactions/sagas, a gateway, service discovery, distributed tracing, and multi-service CI/CD and local dev.
- The current tenant-isolation guarantee (shared Postgres + RLS + `set_config('app.business_id')`) does not carry over unchanged to per-service databases.
- We need one decision: how far to split now vs. how to keep future splitting cheap.

## Proposed Change

Pick one target. Recommendation: **Option A**.

### Option A — Modular monolith now, microservice-ready seams (recommended)

- Keep one deployable `api` for the MVP.
- Enforce hard module boundaries: each bounded context is a Nest module exposing a typed service interface; **no module reads another module's tables**. Cross-context reads go through the owning module's service.
- Introduce an internal event bus abstraction now (`EventBus.publish/subscribe`), backed in-process for the monolith. Domain events (`BusinessCreated`, `StockFellBelowThreshold`, `SaleCompleted`, …) are the integration contract.
- Notifications already run on a queue (BullMQ/Redis) — keep that worker logically separate so it is the first clean extraction.
- Package layout: `api/src/contexts/<context>/…` with an ESLint boundary rule forbidding cross-context imports except through `…/contexts/<context>/public.ts`.
- Extract a context into its own service only when metrics justify it; the event contract and module interface make that a lift-and-shift, not a rewrite.
- Tenant isolation unchanged (shared Postgres + RLS).

### Option B — Microservices from day one

- Services along bounded contexts, each its own deployable + database schema:
  - `gateway` (BFF: TLS, auth token verification, request routing, rate limiting)
  - `identity` (users, operators, credentials, tokens)
  - `tenancy` (businesses, memberships, invitations)
  - `catalog` (products, categories, pricing incl. winger price)
  - `inventory` (stock items, movements, low-stock detection)
  - `sales` (sales, receipts)
  - `winger` (reseller read model / portal API)
  - `notifications` (email/SMS workers, templates)
- Transport: async via a broker (NATS or RabbitMQ) for domain events; sync via `@nestjs/microservices` (gRPC or NATS request/response) only where a query cannot be denormalized.
- Data: database-per-service. No cross-service SQL. Each service owns its migrations. Tenant scoping (`business_id`) enforced per service; RLS optional per service DB.
- Cross-service consistency: outbox pattern + idempotent consumers; sagas for multi-service writes (e.g. sale → stock decrement).
- Infra: local `docker-compose` gains the broker + one container per service; production target becomes Kubernetes (or Nomad). Shared libraries for auth, error envelope, event schemas, tenant context.
- Cost: larger. Phase 00 tasks partly redone; new phase for platform/infra.

### Option C — Hybrid

- Monolith `core` (identity, tenancy, catalog, inventory, sales, winger) + independently deployed `notifications` and later `reporting`/`media` services from the start, over a broker.
- Middle ground: real service boundary where load is spiky/async, monolith where transactional coupling is high.

## Expected Design Impact

- Rewrite `docs/design/architecture/system-overview.md`; add `docs/design/architecture/service-decomposition.md` (context map, ownership, sync vs async, data ownership).
- `docs/design/architecture/multi-tenancy.md`: how `business_id` scoping and RLS apply under the chosen model.
- `docs/design/interfaces/`: add an events catalog + inter-service contracts (Option B/C).
- `docs/design/integrations/README.md`: add the message broker.

## Expected Implementation Impact

- Option A: refactor `api/src` into `contexts/*` with a boundary lint rule; add `EventBus`; small. No new phase.
- Option B: new "Phase 0X — Platform" (broker, gateway, service template, shared libs, per-service DB + migrations, local orchestration, tracing); re-slice T-0005..T-0009 per service; revisit T-0001/T-0009.
- Option C: as Option A plus standing up the broker and the `notifications` service now.

## Open Questions

1. Which option — A, B, or C?
2. If B/C: broker preference — NATS (light, k8s-friendly) vs RabbitMQ vs Redis Streams?
3. If B/C: sync inter-service calls — gRPC or NATS request/reply?
4. Database-per-service, or shared Postgres with a schema per service?
5. Production orchestration — Kubernetes assumed for B/C? Confirm, since hosting was left "containerized, provider deferred".
6. Is the shared-Postgres + RLS tenant-isolation decision open for change, or must every option preserve an equivalent guarantee?
7. Team/ops capacity to run a multi-service system for the MVP.

## Recommendation

Adopt **Option A** now: it delivers "split into services later, cheaply" without imposing distributed-systems overhead on the MVP. Reassess for Option B at the end of Phase 03 (sales) using real load and team signals. If the requirement is a hard "microservices from day one", proceed with **Option B** and insert a Platform phase before T-0005.
