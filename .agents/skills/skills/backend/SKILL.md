---
name: backend
description: Index for backend service work — scaffolding a NestJS microservice under services/*, and the repeatable per-service tasks (Prisma model + RLS, domain event, idempotent consumer, NATS RPC, gateway endpoint, per-service CI).
role: backend
version: 1.0.0
---

## Trigger

Use this skill when working in `services/*` or the shared backend packages
(`packages/contracts`, `packages/nest-common`, `packages/testing`). It is the
master index for the repeatable backend tasks in this monorepo.

Do **not** use for `mobile/` (see [mobile](../mobile/SKILL.md)) or for pure doc
work (see [workflow-contract](../../workflow-contract/SKILL.md) first).

## Canonical design docs (read before editing)

`docs/design/` is approved truth; these skills must stay consistent with it.

- `docs/design/architecture/service-decomposition.md` — per-service ownership, transport, data rules
- `docs/design/architecture/system-overview.md` — runtime request path
- `docs/design/architecture/multi-tenancy.md` — internal context + RLS model
- `docs/design/interfaces/events-catalog.md` — every domain event, stream, consumer
- `docs/design/interfaces/internal-rpc.md` — every request/reply subject
- `docs/design/interfaces/api-contract.md` — the gateway's public REST contract
- `docs/design/data/data-model.md` — tables and ownership

New behavior not in these docs → `docs/changes/proposed/` first. Do not invent
contract in a service.

## Architecture (verified against the repo)

```
services/
  <svc>/
    package.json              # @pos/<svc>; deps on @pos/contracts + @pos/nest-common
    nest-cli.json  tsconfig.json  tsconfig.build.json  vitest.config.ts  oxlint.json
    prisma/schema.prisma      # own tables + OutboxMessage + ProcessedEvent; url = env("<SVC>_DATABASE_URL")
    src/
      main.ts                 # NestFactory + configureApp + Swagger + registerNotFoundFallback (from @pos/nest-common)
      app.module.ts           # ConfigModule, PrismaModule, PlatformModule, <domain modules>, HealthModule.forRootAsync
      config/{config.module.ts,env.ts}   # zod env schema via makeEnvValidator
      prisma/{prisma.module.ts,prisma.service.ts}   # @Global; pingDatabase() for health
      platform/                # PlatformModule → NatsModule.forRootAsync; OutboxRelayService (OnApplicationBootstrap)
      <domain>/                # controllers, DTOs (class-validator), services, guards
      rpc/<svc>.rpc.ts         # bus.reply(SUBJECTS.<svc>.<Method>, ...) handlers, if any
packages/
  contracts/src/    subjects.ts  events.ts  rpc.ts  envelope.ts  errors.ts  internal-context.ts  messaging.ts
  nest-common/src/  http/ app/ openapi/ tenant/ config/ health/ messaging/{outbox,idempotency,consumer,nats.*}
  testing/src/      in-memory-bus.ts  in-memory-stores.ts  fixtures.ts
```

MVP services (`gateway` + 7): `gateway`, `identity`, `tenancy`, `catalog`,
`inventory`, `sales`, `winger`, `notifications`. Only `identity` (full) and a
`gateway`/`tenancy` skeleton exist so far.

## Task index

| Task | Skill | When |
|---|---|---|
| Create a new service module | [scaffold-service](scaffold-service.md) | a `services/<svc>/` dir does not exist yet |
| Add a table + migration + tenant RLS | [add-prisma-model](add-prisma-model.md) | new persisted data owned by one service |
| Add a domain event (emit) | [add-event](add-event.md) | a state change other contexts must learn about |
| Consume an event idempotently | [add-consumer](add-consumer.md) | a service reacts to another's event |
| Add a NATS request/reply method | [add-rpc](add-rpc.md) | caller needs fresh data it cannot own a copy of |
| Add a gateway REST endpoint | [add-endpoint](add-endpoint.md) | new row in `api-contract.md` |
| Add the per-service CI job | [add-service-ci](add-service-ci.md) | right after `scaffold-service` |
| Conventions, commands, sensitive areas | [guidelines](guidelines.md) | always, first time in a session |

## Usage by task

**...stand up a new domain service**
→ [scaffold-service](scaffold-service.md) → [add-prisma-model](add-prisma-model.md) → [add-service-ci](add-service-ci.md) → wire events/RPC as needed

**...propagate a state change to other services**
→ [add-event](add-event.md) (producer) → [add-consumer](add-consumer.md) (each consumer)

**...expose a new REST operation**
→ [add-endpoint](add-endpoint.md) (+ [add-rpc](add-rpc.md) if the gateway needs synchronous data)

## Non-negotiables (from design)

- A service never reads another service's schema/DB. Reference by id only.
- Every producer emits via the **transactional outbox** (`OutboxWriter` + relay), never a direct publish in a handler.
- Every consumer is **idempotent on `event_id`** (`runIdempotent` / `processed_events`) and has a DLQ.
- Downstream services reject a missing/invalid internal context, then `runInTenantContext(business_id)` so RLS scopes every statement. `identity` is the only service with no tenant tables.
- Contracts (`zod` schemas, subject constants) live only in `@pos/contracts`. Breaking a schema = new versioned subject + deprecation window.
- Run `pnpm format && pnpm lint && pnpm test` before proposing backend changes.
