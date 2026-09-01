# /add-rpc

Add a synchronous NATS request/reply subject. Rare — use only when the caller
cannot own an eventually-consistent copy and staleness is unacceptable. Otherwise
use `/add-event`.

Full skill: [`.agents/skills/skills/backend/add-rpc.md`](../skills/backend/add-rpc.md).

## When

The subject is a row in `docs/design/interfaces/internal-rpc.md` (the MVP has six
total). If it is not there, change the design first.

## Steps

1. **Contracts** — request + response `zod` in `packages/contracts/src/rpc.ts`; subject `pos.rpc.<context>.<Method>` in `subjects.ts`.
2. **Responder** — `bus.reply(SUBJECTS…, handler)` in `src/rpc/<svc>.rpc.ts` (pattern: `services/identity/src/rpc/identity.rpc.ts`); run tenant-scoped; idempotent on the request id (`reservation_id`) where applicable. Register `<Svc>Rpc` in a module.
3. **Caller wrapper** — `bus.request(subject, req, { timeoutMs: DEFAULT_RPC_TIMEOUT_MS })`; parse the response schema; timeout/error → `503 upstream_unavailable`, retryable with backoff.

## Rules

- Every request carries the signed internal context; saga steps use `token_kind: "system"` + explicit `business_id`.
- Response never contains another tenant's data. No fire-and-forget disguised as RPC.

## Tests

Schema tests; idempotency under duplicate delivery; dropped-responder → caller
fails cleanly with `503`, no partial write; tampered context → rejected.
