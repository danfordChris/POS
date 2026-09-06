# T-0304 Sales — Void Handler + Inventory Reversal Consumer

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/data/data-model.md` ("Voiding a sale: insert `void_reversal` movements equal and opposite … set `receipt.status = void`"), `docs/design/interfaces/events-catalog.md` (`SaleVoided`), `docs/design/interfaces/api-contract.md` (`POST /sales/{id}/void`, Owner)
- Constraints: void is Owner-only and idempotent (a second void of the same sale is a no-op `200`); `sales` sets `sale.status = 'voided'`, `sale.voided_at`, `receipt.status = 'void'` and emits `SaleVoided` (with the line `product_id`/`quantity` list) — it does **not** touch the ledger; `inventory` consumes `SaleVoided` and writes one `void_reversal` `stock_movement` per line (`quantity_delta = +quantity`, `reference_type = 'sale_void'`, `reference_id = sale_id`) and moves `stock_item.quantity` back, idempotent on `event_id`; a void of a not-`completed` sale → `409 conflict`.
- Do not touch: `catalog`, `tenancy`, `web/`, `mobile/`. `inventory` changes are limited to the new `SaleVoided` consumer + its wiring (no change to movement/edge logic).

## Objective

Add `POST /v1/businesses/{businessId}/sales/{id}/void` to `sales` and a `SaleVoided` consumer to `inventory` that reverses the stock.

## Scope Boundary

**In scope (`sales`):**
- `SalesController` `POST /sales/{id}/void` (`RolesGuard('owner')`).
- `SalesService.voidSale`: load the sale (tenant-scoped, `404` if missing); `409 conflict` if not `completed`; in one txn set `sale.status='voided'` + `voided_at`, `receipt.status='void'`, write the `SaleVoided` outbox row (`lines` from `sale_line`). A re-void returns `200` with the already-voided sale.

**In scope (`inventory`):**
- `SaleVoidedConsumer` (`subscribeWithDlq`, `durable: 'inventory-sale-voided'`, `dlqSubject('sales','SaleVoided')`): for each line, in `runInTenantContext(business_id)`, append a `void_reversal` movement and move `stock_item.quantity` by `+quantity`; `runIdempotent` on `event_id`. Reuse the existing movement/edge helper so the low-stock edge + `StockLevelChanged` / `StockMovementRecorded` still fire.
- Register the consumer in `StockModule` (or a small `consumers` addition).

**Out of scope:**
- Web void button — T-0309. Mobile has no void screen in MVP.
- Direct `reverseReservation` RPC — the event path is sufficient.

## Acceptance Criteria

- `POST /sales/{id}/void` as Owner returns `200` with `status: 'voided'`; the `receipt.status` is `void`; a `SaleVoided` outbox row exists with every line's `product_id` + `quantity`.
- As Staff → `403 role_forbidden`. Void of an unknown sale → `404`. Void of an already-voided sale → `200` (no new `SaleVoided`). Void of a sale in any non-`completed` state that is not `voided` → `409 conflict`.
- After `inventory` processes `SaleVoided`, `stock_item.quantity` for every line equals its pre-sale value, and one `void_reversal` `stock_movement` per line exists (`quantity_delta` positive, `reference_id = sale_id`).
- Delivering the same `SaleVoided` twice (same `event_id`) reverses once (idempotency test).

## Dependencies

- T-0302

## Implementation Checklist

1. `sales`: void controller + `voidSale` (state machine + outbox) + idempotent re-void.
2. `@pos/contracts`: confirm `saleVoidedPayload` carries `lines` (added in T-0301).
3. `inventory`: `SaleVoidedConsumer` reusing the movement helper; register + DLQ.
4. e2e — `sales`: void happy path, role, 404, re-void, 409; `inventory`: reversal + idempotency (pre-sale on-hand restored).
5. `pnpm --filter @pos/sales --filter @pos/inventory test`, `pnpm -r build/lint`; validator.

## Verification

- `services/sales/test/*` + `services/inventory/test/*` cover the criteria above.
- `pnpm --filter @pos/sales test` + `pnpm --filter @pos/inventory test` green; `pnpm -r build` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
