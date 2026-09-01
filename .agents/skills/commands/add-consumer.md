# /add-consumer

Make a service react to another service's domain event — durable, idempotent on
`event_id`, with a dead-letter subject.

Full skill: [`.agents/skills/skills/backend/add-consumer.md`](../skills/backend/add-consumer.md).

## When

An (event → consumer) pair listed in `docs/design/interfaces/events-catalog.md`.

## Steps

1. Handler class implementing `OnApplicationBootstrap`; `subscribeWithDlq(bus, { subject: SUBJECTS…, durable: '<svc>-<event-kebab>', maxDeliver: 5 }, handler)` from `@pos/nest-common`.
2. Wrap side effects in `runIdempotent(new PrismaIdempotencyStore(prisma), meta.eventId, ...)` — duplicate delivery is a no-op.
3. Tenant side effects inside `runInTenantContext(evt.business_id, ...)`.
4. Parse the payload with the `@pos/contracts` schema. Treat copied fields as a read-only cache.
5. Register the consumer in the domain module `providers`.

## Tests (required)

- Same `event_id` twice → exactly one state change.
- Poison payload → redelivered up to `maxDeliver`, then `pos.dlq.<context>.<Event>`, no infinite loop.

Use `InMemoryBus` + in-memory idempotency store from `@pos/testing`.

## Verify

`pnpm --filter @pos/<svc> test`.
