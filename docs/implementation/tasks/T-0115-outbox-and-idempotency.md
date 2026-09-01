# T-0115 Outbox + Idempotent-Consumer Helpers

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md`, `docs/design/interfaces/events-catalog.md`, `docs/design/interfaces/internal-rpc.md`
- Constraints: exactly-once effect via at-least-once delivery + idempotency; try/catch around publish + ack; no business logic in the helpers.
- Do not touch: individual service domain code.

## Objective

`@pos/nest-common` provides a transactional-outbox writer + relay and an idempotent-consumer wrapper, plus a NATS bootstrap for events and request/reply, all covered by tests.

## Scope Boundary

**In scope:**
- `outbox` table migration snippet (`id`, `subject`, `payload`, `headers`, `created_at`, `sent_at`) + `OutboxWriter.write(tx, subject, payload)` (writes in the caller's transaction).
- `OutboxRelay`: polls unsent rows, publishes to JetStream, marks `sent_at`; at-least-once; backoff on failure; metrics/log.
- `processed_events` table snippet + `IdempotentHandler(eventId, fn)` — records `event_id`, no-ops on duplicate.
- `NatsModule`: connect, publish, durable subscribe (events), request/reply server + client, graceful drain on shutdown.
- Dead-letter: after max-deliver, publish to `pos.dlq.<context>.<Event>`.
- `@pos/testing`: in-memory NATS double + fixtures.

**Out of scope:**
- Per-service wiring (each service task consumes these).

## Acceptance Criteria

- [x] `OutboxWriter.write` uses the caller's `tx.$executeRaw`; a rolled-back fake transaction commits no row, a committed one is picked up and published exactly once by `OutboxRelay.tick()` (second tick publishes 0).
- [x] Crash recovery: a row whose `markSent` throws stays unsent and is re-published on the next tick (`bus.publishes` grows to 2 for one row); a publish failure records `attempts + 1` + `last_error` and leaves the row unsent.
- [x] `runIdempotent(store, eventId, …)` runs `fn` once across two calls with the same id; a throwing `fn` does not mark the event.
- [x] `subscribeWithDlq`: acks on first success; retries to `maxDeliver` then publishes to `dlqSubject` with `x-original-subject` / `x-error` / `x-delivery-count` headers and terminates; recovers if a later delivery succeeds.
- [x] `InMemoryBus.request`/`reply` round-trips a payload; no responder → `RpcTimeoutError`. `MessageBus` is the shared interface (`@pos/contracts`) implemented by both `InMemoryBus` and `NatsCoreBus`.
- [x] `@pos/testing` exports `InMemoryBus` (subject wildcards, nak redelivery, `flush()`), `InMemoryOutboxStore`, `InMemoryIdempotencyStore`, `makeFakeTx`, `envelopeFixture`.
- Deferred to T-0112: `NatsCoreBus` currently does core pub/sub + request/reply only; durable JetStream consumers with real `ack`/`nak`/`deliveryCount` are layered in once the broker (T-0111) is running. All retry/DLQ/outbox/idempotency logic is transport-agnostic and covered by the in-memory bus.

## Dependencies

- T-0110, T-0111

## Implementation Checklist

- [x] `@pos/contracts/messaging.ts` — `MessageBus`, `BusMessage`, `PublishOptions`, `SubscribeOptions`, `RpcTimeoutError`, `DEFAULT_RPC_TIMEOUT_MS`, `makeEnvelope`.
- [x] `@pos/nest-common/messaging/outbox.ts` — `OUTBOX_TABLE_SQL`, `OutboxStore`, `OutboxWriter`, `OutboxRelay` (poll/backoff/guard), `PrismaOutboxStore`.
- [x] `@pos/nest-common/messaging/idempotency.ts` — `PROCESSED_EVENTS_TABLE_SQL`, `IdempotencyStore`, `runIdempotent`, `PrismaIdempotencyStore`.
- [x] `@pos/nest-common/messaging/consumer.ts` — `subscribeWithDlq` (retry → dead-letter).
- [x] `@pos/nest-common/messaging/nats.adapter.ts` + `nats.module.ts` — `NatsCoreBus` + `NatsModule.forRoot/forRootAsync/forTest` (`MESSAGE_BUS` token).
- [x] `@pos/testing` — `InMemoryBus`, `InMemoryOutboxStore`, `InMemoryIdempotencyStore`, `makeFakeTx`, `envelopeFixture`, `subjectMatches`.
- [x] Specs: `in-memory-bus` (5), `outbox` (5), `idempotency` (2), `consumer` (3).

## Verification

- `pnpm -r test` → contracts 5, testing 5, nest-common 15, api 16 = **41 pass**.
- `pnpm -r build` — contracts, testing, nest-common, web, api all Done.
- `pnpm -r lint` + `pnpm format:check` clean; api OpenAPI drift in sync.
