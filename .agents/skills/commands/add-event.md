# /add-event

Emit a domain event (a past-tense fact) for other services to consume. Async-first
— this is the default way state crosses a service boundary.

Full skill: [`.agents/skills/skills/backend/add-event.md`](../skills/backend/add-event.md).

## When

A state change in one service that another context must learn about, and it is
(or will be) listed in `docs/design/interfaces/events-catalog.md`.

## Steps

1. **Contract** — `zod` payload schema in `packages/contracts/src/events.ts`; subject constant `pos.evt.<context>.<Event>` in `subjects.ts`. Export both.
2. **Round-trip test** in `packages/contracts`.
3. **Emit via outbox** — domain write + `OutboxWriter.write(SUBJECTS…, makeEnvelope(...))` in the **same** Prisma transaction. Never `bus.publish` from a handler.
4. Envelope: `event_id`, `occurred_at`, `business_id` (null only for identity), `producer`, `schema_version`. No secret/hash/token in the payload.
5. Handle each consumer → `/add-consumer`.

## Rules

- Past-tense name (`ProductUpserted`). Additive field → bump `schema_version` minor; breaking → new `…V2` subject + deprecation window.
- Row in `events-catalog.md` first; undocumented events do not ship.

## Verify

`pnpm --filter @pos/contracts test && pnpm --filter @pos/<svc> test`; integration: one `outbox` row → relay tick → published.
