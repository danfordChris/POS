# Backend — Service Work Index

Use for any work in `services/*` or the shared backend packages
(`packages/contracts`, `packages/nest-common`, `packages/testing`).

Full skills: `.agents/skills/skills/backend/`. Read
[`SKILL.md`](../skills/backend/SKILL.md) and
[`guidelines.md`](../skills/backend/guidelines.md) first.

## Repeatable tasks

- `/scaffold-service` — new `services/<svc>/` NestJS module (mirrors `services/identity/`)
- `/add-prisma-model` — table + migration + tenant RLS in one service's schema
- `/add-event` — emit a domain event via the transactional outbox (+ `@pos/contracts` schema)
- `/add-consumer` — durable, idempotent event consumer with a DLQ
- `/add-rpc` — NATS request/reply subject (rare; must be in `internal-rpc.md`)
- `/add-endpoint` — gateway REST route + downstream handler + contract tests

## Design truth (do not invent contract in a service)

- `docs/design/architecture/service-decomposition.md` — ownership, transport, data rules
- `docs/design/interfaces/{events-catalog,internal-rpc,api-contract}.md`
- `docs/design/data/data-model.md`
- New behavior → `docs/changes/proposed/` first; route via `/workflow-contract`.

## Always

- Emit only via the outbox; consumers idempotent on `event_id`; every consumer has a DLQ.
- No service reads another's DB. Contracts live only in `@pos/contracts`.
- Downstream: reject bad internal context, then `runInTenantContext(business_id)`.
- `pnpm format && pnpm lint && pnpm test` before proposing changes.
