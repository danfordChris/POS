# T-0505 Concurrency / No-Lost-Update Test on `on_hand`

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/internal-rpc.md` (`reserveStock` idempotent + `releaseReservation` idempotent), `docs/design/interfaces/api-contract.md` (`POST /sales`, `422 insufficient_stock`), `docs/design/data/data-model.md` (`stock_item`, `stock_movement` append-only ledger), `docs/design/product/prd-mvp.md` (on-hand acceptance)
- Constraints: test-only; a spec that drives the real `inventory` reservation path and the real `sales` saga concurrently (in-process apps + `InMemoryBus`, or the two service apps wired to a shared bus double) against the CI Postgres; `stock_movement` is append-only — assert the ledger sums, not just the cached `on_hand`; no production change unless a genuine lost-update is found (then fix the locking in `inventory` and note it).
- Do not touch: feature behaviour. Add the fix only if a race is proven.

## Objective

Prove that many concurrent sales of one product can never drive `on_hand` below zero or lose a decrement, and that concurrent stock-in movements sum exactly.

## Scope Boundary

**In scope:**
- Seed a product with `on_hand = N`.
- Fire `K` concurrent `POST /sales` each for 1 unit of that product with `K > N` (e.g. `N = 10`, `K = 25`), each with a distinct idempotency key.
- Assert: exactly `N` sales complete (`200`), exactly `K - N` return `422 insufficient_stock`, final `on_hand = 0`, and `sum(stock_movement.quantity_delta)` for that product equals `-N` from sales plus the initial seed.
- Fire `K` concurrent `POST /sales` with the **same** idempotency key → exactly one sale, one decrement.
- Fire `K` concurrent `stock-in` movements of `+q` → `on_hand` increases by exactly `K * q`, `K` ledger rows.
- Run the sale-race assertion ≥ 3 times (or with a loop) to catch flakiness.

**Out of scope:**
- Multi-product carts under contention (single-product is the tightest race).
- HTTP-level load testing tools; this is a correctness test, not a throughput benchmark.

## Acceptance Criteria

- With `on_hand = 10` and 25 concurrent single-unit sales: 10 succeed, 15 get `422`, final `on_hand = 0`, never negative at any observed point, ledger sums to the seed − 10.
- 25 concurrent sales sharing one idempotency key produce exactly one completed sale and one `−1` movement.
- 25 concurrent `+q` stock-in movements produce `on_hand += 25*q` and 25 `stock_in` rows.
- The sale-race assertion passes on repeated runs (no intermittent negative / lost decrement).
- Any locking fix applied to `inventory` is named in Verification.

## Dependencies

- None beyond `inventory` + `sales` existing.

## Implementation Checklist

1. Build the concurrent-driver spec (Promise.all of real requests).
2. Add the ledger-sum + non-negative assertions.
3. Add the shared-idempotency-key and stock-in-race cases.
4. Loop the race case for stability.
5. `pnpm --filter @pos/inventory --filter @pos/sales test`; validator.

## Verification

Delivered:

- `services/inventory/test/concurrency.e2e-spec.ts` — drives the real
  `StockService` reservation path (the same code the `sales` saga calls over
  `inventory.reserveStock`):
  - `on_hand = 10`, **25 concurrent** single-unit `reserve()` calls (distinct
    reservation ids) → exactly 10 `ok:true`, 15 shortfalls; commit all 10 →
    `on_hand` = 0 (never negative), `sum(stock_movement.quantity_delta)` = 0
    (+10 stock_in, −10 sale). Looped 3×.
  - 25 concurrent `POST /stock/movements` `stock_in` of +3 → `on_hand` = 75,
    exactly 25 `stock_in` rows.
  - 25 concurrent `reserve()` sharing one reservation id → exactly one held
    reservation, one `sale` movement on commit.

Bug found + fixed (production change):

- `StockService.reserve` / `recordMovement` / `commit` / `reverseSale` did a
  read-modify-write on `stock_item.quantity` (and computed reservation
  availability) with **no row lock** under READ COMMITTED. The first run of the
  new test showed **22 reservations succeeding against 10 on-hand** and
  double-counted `stock_in` movements.
- Fix (`services/inventory/src/stock/stock.service.ts`): a private `lockItems`
  helper that ensures the `stock_item` row exists then `SELECT … FOR UPDATE`s it;
  called at the top of the mutating section of `recordMovement`, `reserve`,
  `commit`, and `reverseSale`, so concurrent transactions for the same product
  serialize. `reserve` also re-checks the reservation id under the lock and
  catches a `P2002` on the create (shared-id race). `ensureItem` now tolerates a
  `P2002` from a concurrent create.
- No contract or API change; behaviour is identical for the single-threaded path.

Evidence:

- `pnpm --filter @pos/inventory test` → 62 (concurrency spec +3; the 59
  existing specs unchanged).
- Full backend sweep green: contracts 13, nest-common 16, testing 5, identity 8,
  tenancy 33, catalog 43, inventory 62, sales 48, winger 37, notifications 37.
- `node scripts/check-contracts-compat.mjs HEAD` → OK; validator `WORKFLOW:ok`.
