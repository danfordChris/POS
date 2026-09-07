# T-0505 Concurrency / No-Lost-Update Test on `on_hand`

## Status

- `pending`
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

Run and capture:

- The concurrency spec output: succeed/`422` split, final `on_hand`, ledger sum, repeated-run stability.
- Any `inventory` locking change (expected: none — `reserveStock` already row-locks).
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
