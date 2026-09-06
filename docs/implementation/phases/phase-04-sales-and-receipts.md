# Phase 04 — Sales and Digital Receipts

## Status

- `done`
- Last updated: 2026-09-07

## Objective

Record sales that decrement stock through the `inventory` ledger via the reserve → commit saga, issue a public receipt link, and support void with full reversal.

## Scope

- New `services/sales` (`sale`, `sale_line`, `receipt`, `sale_number_counter`, `product_cache`) in the `sales` schema + RLS.
- `POST /v1/businesses/{id}/sales` (Owner/Staff): `reserveStock` RPC → write `sale`/`sale_line`/`receipt` + `SaleCompleted` (outbox) in one tenant txn → `commitReservation` RPC. Any failure → `releaseReservation`, no sale rows. `Idempotency-Key` replays the original sale. `422 insufficient_stock` from `reserveStock` shortfalls.
- The `sale` / `void_reversal` stock movements are written by **`inventory`** on `commitReservation` and on the `SaleVoided` consumer — `sales` never writes to the ledger.
- Per-business `sale.number` from `sale_number_counter` (`FOR UPDATE`); price + name snapshots on `sale_line` (from `product_cache` when the client omits `unit_price`); business name/currency snapshot on `receipt`.
- `POST /v1/businesses/{id}/sales/{id}/void` (Owner) → `receipt.status = void`, emit `SaleVoided`; `inventory` writes the equal-and-opposite `void_reversal` movements.
- `GET /v1/r/{public_token}` — public, unauthenticated (Kong route without `pos-internal-context`); payload = business name, lines, totals, timestamp; no internal IDs. Unknown / void token → 404.
- `GET /v1/businesses/{id}/sales` (Owner all, Staff own), `GET .../sales/{id}` (Owner; Staff own).
- `@pos/contracts`: `SUBJECTS.sales.*`, `saleCompletedPayload` / `saleVoidedPayload`; `inventory` gains a `SaleVoided` consumer.
- Mobile: sell flow (add lines by scan/pick, qty, line discount, running total, `422` inline), receipt screen (link + QR + share sheet).
- Web: sales table, sale detail, void.

## Features

- Line-level optional discount; running total in the sell UI.
- Receipt view shows business name, lines, totals, timestamp; no internal IDs.

## Tasks

- [x] T-0301 `sales` service scaffold + `sale` / `sale_line` / `receipt` / `sale_number_counter` / `product_cache` models + migration + RLS + `@pos/contracts` sale events
- [x] T-0302 `sales` — `POST /sales` reserve → write → commit saga + `Idempotency-Key` replay + `product_cache` consumers
- [x] T-0303 `sales` — insufficient-stock path (`422`, `releaseReservation`, no `sale`/`sale_line` rows)
- [x] T-0304 `sales` — `POST /sales/{id}/void` + `SaleVoided`; `inventory` — `SaleVoided` consumer writing `void_reversal` movements
- [x] T-0305 `sales` — public `GET /v1/r/{token}` + token generation + Kong route (no internal-context plugin)
- [x] T-0306 `sales` — `GET /sales` + `GET /sales/{id}` with Owner-all / Staff-own scoping
- [x] T-0307 Mobile — sell flow + `422 insufficient_stock` handling
- [x] T-0308 Mobile — receipt screen (link + QR + share)
- [x] T-0309 Web — sales list / detail / void

## Acceptance Criteria

- [x] Completing a sale decreases on-hand per line and writes one `sale` movement per line (in `inventory`), atomically with the reservation commit.
- [x] A sale exceeding on-hand returns `422 insufficient_stock` and creates no `sale` or `sale_line` rows.
- [x] Void restores on-hand to pre-sale values for every line (`void_reversal` movements) and marks the receipt `void`.
- [x] `GET /v1/r/{token}` returns 200 with no `Authorization` header; unknown / void token returns 404.
- [x] Re-sending `POST /sales` with the same `Idempotency-Key` returns the original sale, not a duplicate.
- [x] Dropping `inventory` makes `POST /sales` fail cleanly with `503` and no partial sale (per internal-rpc acceptance).

## Blockers

- Phase 02 stock ledger `done` (met); `inventory` reserve/commit/release RPC `done` (T-0105).
- Phase 03 `done`.

## Linked Tasks

- `docs/implementation/tasks/`
