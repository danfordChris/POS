# Add a NATS Request/Reply Method

Synchronous inter-service call over NATS request/reply. Use **only** when the
caller needs data it cannot own an eventually-consistent copy of and staleness is
unacceptable. Everything else is an event ([add-event](add-event.md)).

## Arguments

`$ARGUMENTS` — subject + caller + shapes, e.g.
`inventory.reserveStock, caller sales, req { business_id, reservation_id, lines[] }, res { ok } | { ok:false, shortfalls[] }`

Must match a row in `docs/design/interfaces/internal-rpc.md`. If it is not there,
the design must change first — request/reply is deliberately rare (the MVP has
six subjects total).

## Rules

- Subject: `pos.rpc.<context>.<Method>`. Constant in `@pos/contracts/src/subjects.ts`.
- Request + response `zod` schemas in `@pos/contracts/src/rpc.ts`.
- Default timeout 2s (`DEFAULT_RPC_TIMEOUT_MS` in `@pos/contracts`). Caller handles timeout → `503 upstream_unavailable`, retryable with backoff (except validation errors).
- Every request carries the signed internal context (`request_id`, `user_id`, `business_id|null`, `role|null`, `token_kind`). Saga steps use `token_kind: "system"` and set `business_id` explicitly.
- Handler runs tenant-scoped; a response never contains another tenant's data.
- Reserve/commit/release-class handlers are **idempotent** on the id in the request (`reservation_id`).
- No fire-and-forget disguised as RPC. If a handler would need a cross-service join, redesign toward an event-fed local copy.

## Steps

### 1. Contracts

`packages/contracts/src/rpc.ts`:

```ts
export const reserveStockRequest = z.object({
  business_id: z.string().uuid(),
  reservation_id: z.string().uuid(),
  lines: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() })),
});
export const reserveStockResponse = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), shortfalls: z.array(z.object({ product_id: z.string().uuid(), short: z.number().int() })) }),
]);
```

`subjects.ts`: `SUBJECTS.inventory.reserveStock = 'pos.rpc.inventory.reserveStock'`.

### 2. Responder (owning service)

In `src/rpc/<svc>.rpc.ts` (pattern: `services/identity/src/rpc/identity.rpc.ts`):

```ts
async onApplicationBootstrap(): Promise<void> {
  await this.bus.reply(SUBJECTS.inventory.reserveStock, async (raw) => {
    const req = reserveStockRequest.parse(raw);
    return runInTenantContext(this.prisma, req.business_id, () =>
      this.reservations.reserve(req));   // idempotent on req.reservation_id
  });
}
```

Register `<Svc>Rpc` in the domain module `providers`.

### 3. Caller wrapper

Thin typed method on the calling service; parse the response schema; map timeout
/ error to `503 upstream_unavailable`.

```ts
const res = reserveStockResponse.parse(
  await this.bus.request(SUBJECTS.inventory.reserveStock, req, { timeoutMs: DEFAULT_RPC_TIMEOUT_MS }),
);
```

### 4. Tests

- Request + response schema tests in `packages/contracts`.
- Idempotency: same `reservation_id` twice → one reservation.
- Caller test: responder absent → caller fails cleanly with `503`, no partial local write (e.g. no `sale` rows).
- Tampered internal context → responder rejects.

## Verification

```bash
pnpm --filter @pos/contracts test
pnpm --filter @pos/<caller> test
pnpm --filter @pos/<owner> test
```

## Checklist

- [ ] Row present in `internal-rpc.md`; genuinely cannot be an event
- [ ] `pos.rpc.<context>.<Method>` constant + req/res zod in `@pos/contracts`
- [ ] Responder in `src/rpc/<svc>.rpc.ts`, registered in a module, tenant-scoped
- [ ] Idempotent on the request id where applicable
- [ ] Caller parses the response schema and maps failure → `503`, retryable/backoff
- [ ] Dropped-responder test: caller fails cleanly, no partial write
- [ ] Tampered-context test: rejected
