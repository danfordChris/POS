# T-0115 Outbox + Idempotent-Consumer Helpers

## Status

- `pending`
- Last updated: 2026-09-01

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

- [ ] A domain write + `OutboxWriter.write` in one transaction: rollback leaves no outbox row; commit → relay publishes exactly the payload.
- [ ] Relay restart after a crash mid-publish does not lose or (beyond at-least-once) duplicate-effect messages.
- [ ] `IdempotentHandler` invoked twice with the same `event_id` runs `fn` once.
- [ ] A handler that throws past max-deliver lands the message on the dead-letter subject.
- [ ] `NatsModule` request/reply round-trips a schema-validated payload; a 2s timeout surfaces as a typed error.
- [ ] `@pos/testing` NATS double supports pub/sub + request/reply for service tests.

## Dependencies

- T-0110, T-0111

## Implementation Checklist

- [ ] Implement `OutboxWriter` + `OutboxRelay` + migration snippet.
- [ ] Implement `processed_events` + `IdempotentHandler`.
- [ ] Implement `NatsModule` (events + request/reply + drain + DLQ).
- [ ] Build `@pos/testing` NATS double + fixtures.
- [ ] Unit + integration tests for every Acceptance Criteria row.

## Verification

- Command: `pnpm --filter @pos/nest-common test && pnpm --filter @pos/testing test`
- Evidence: test report covering outbox rollback/commit, relay crash-recovery, idempotency, DLQ, and request/reply timeout, pasted into the PR.
