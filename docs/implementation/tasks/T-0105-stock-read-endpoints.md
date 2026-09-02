# T-0105 Inventory Service — Stock Read Endpoints + Reservation RPC

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (Stock section), `docs/design/interfaces/internal-rpc.md`
- Constraints: reads are tenant-scoped via `runInTenantContext`; RPC never returns another tenant's data; `reserveStock` / `commitReservation` / `releaseReservation` are idempotent on `reservation_id`; on-hand shown by `/stock` is committed `stock_item.quantity`, not availability.
- Do not touch: identity / tenancy / catalog domain logic.

## Objective

Serve `GET /v1/businesses/{businessId}/stock`, `/stock/movements`, `/stock/low` and complete the `reserveStock` / `commitReservation` / `releaseReservation` NATS handlers on `services/inventory`.

## Scope Boundary

**In scope:**
- `StockService.listStock` (cursor paginated, `?active=`), `listMovements` (`?product_id=` `?type=`, cursor), `listLowStock` (on-hand ≤ `reorder_threshold`, threshold > 0, active).
- `StockController` `GET /stock`, `/stock/movements`, `/stock/low` behind `InternalContextGuard` + `TenantGuard` (member).
- `StockService.reserve` / `commit` / `release` + `InventoryRpc` reply handlers; `stock_reservation` lifecycle `held → committed | released`.
- Views (`toStockItemView`, `toMovementView`) — `low_stock` flag derived.

**Out of scope:**
- `POST /stock/movements` — T-0104 (built together in this pass).
- CSV export (web, T-0109).

## Acceptance Criteria

- `GET /stock/low` returns exactly the active products whose on-hand ≤ their `reorder_threshold` (threshold > 0).
- `GET /stock` returns `{ data: [{ product_id, on_hand, reorder_threshold, product_active, low_stock, updated_at }], next_cursor }`; `GET /stock/movements` filters by `product_id` and `type` and paginates newest-first.
- `reserveStock` returns `{ ok: true }` when every line fits `on_hand − sum(held reservations)`, else `{ ok: false, shortfalls: [{ product_id, available }] }` and creates no reservation.
- `reserveStock` with an already-seen `reservation_id` replays the prior outcome; `commitReservation` twice returns `{ ok: true }` once committed and writes `sale` movements only once; `releaseReservation` is a no-op `{ ok: true }` when already released and `{ ok: false }` for a committed reservation.
- A committed reservation reduces `stock_item.quantity` by the reserved quantity and appends one `sale` movement per line (`quantity_delta` negative, `reference_id` = `sale_id`).
- Reads for business B return nothing belonging to business A.

## Dependencies

- T-0104

## Implementation Checklist

1. `StockService` read methods + views.
2. `StockController` GET routes (member-only).
3. `StockService.reserve` / `commit` / `release`; wire `InventoryRpc`.
4. e2e coverage for reads, low-stock, and the reservation saga.
5. `pnpm -r build/test/lint`; validator.

## Verification

- Covered by `services/inventory/test/inventory.e2e-spec.ts` (same suite as T-0104): `/stock` + `/stock/movements` shape and filters, `/stock/low` membership, and the reserve → shortfall → commit (idempotent) → release lifecycle with the `sale` movement assertion.
- `pnpm --filter @pos/inventory test` → 11 passed; `pnpm -r build` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
