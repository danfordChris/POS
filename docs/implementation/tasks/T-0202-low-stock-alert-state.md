# T-0202 Inventory — Low-Stock Alert State + Edge Event Payloads

## Status

- `pending`
- Last updated: 2026-09-06

## Linked Phase

- Phase 03 — Reorder Alerts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/data/data-model.md` (`low_stock_alert_state`, Decisions), `docs/design/interfaces/events-catalog.md` (`StockFellBelowThreshold`, `StockRecovered`), `docs/design/integrations/notifications.md` (Low-stock rules, Delivery)
- Constraints: `low_stock_alert_state` replaces the `stock_item.low_stock_open` column as the edge source of truth; edge row written in the same tenant transaction as the movement (`StockService.applyToItem`); `opened_at` set on the false→true edge and carried unchanged on the matching `StockRecovered`; contract changes are additive only — bump `schema_version` minor, keep `contracts-compat` green; RLS on the new table.
- Do not touch: `services/notifications`, `catalog`, `tenancy`, `web/`, `mobile/`.

## Objective

Introduce `low_stock_alert_state` in `services/inventory`, drop `stock_item.low_stock_open`, and add `opened_at` + `recipients` to the low-stock edge events in `@pos/contracts` and the emitter.

## Scope Boundary

**In scope:**
- Prisma: new `LowStockAlertState` model (`id`, `business_id`, `product_id`, `is_open` Bool, `opened_at` Timestamptz?, `closed_at` Timestamptz?), unique `(business_id, product_id)`, RLS; remove `lowStockOpen` from `StockItem`. Migration handles both.
- `StockService.applyToItem` (and `ensureItem`/product-events consumer as needed): read/write `low_stock_alert_state` instead of `stock_item.low_stock_open`; stamp `opened_at = now()` on false→true, set `is_open=false` + `closed_at=now()` on true→false, keep `opened_at` for the event.
- `@pos/contracts`: `stockFellBelowThresholdPayload` gains `opened_at` (ISO string) + `recipients` (`string[]`); `stockRecoveredPayload` gains `opened_at`; `SCHEMA_VERSION` minor bump; round-trip tests updated.
- Emitter reads `alert_config.recipients` (via a direct `inventory`-schema query — same service) and passes it as `recipients` on `StockFellBelowThreshold` (empty array when unset).
- e2e updates in `services/inventory/test/`.

**Out of scope:**
- `alert_config` table/endpoints — T-0201 (this task depends on it for the `recipients` read).
- Any `notifications`-side behavior.
- `/stock/low` response shape (already correct via `stock_item.quantity <= reorder_threshold`).

## Acceptance Criteria

- After a movement drives on-hand from above threshold to ≤ threshold, exactly one `low_stock_alert_state` row exists for that product with `is_open=true` and a non-null `opened_at`, written in the same transaction as the `stock_movement` row.
- The emitted `StockFellBelowThreshold` carries that `opened_at` and `recipients` equal to `alert_config.recipients` (or `[]` when no config).
- A further sub-threshold movement while `is_open=true` emits **no** new `StockFellBelowThreshold`.
- A movement raising on-hand above threshold sets `is_open=false`, `closed_at` non-null, and emits `StockRecovered` with the same `opened_at` value as the prior open edge.
- A subsequent dip stamps a **new** `opened_at` and emits `StockFellBelowThreshold` again.
- `stock_item` has no `low_stock_open` column after migration; `pnpm --filter @pos/contracts test` and `contracts-compat` are green.

## Dependencies

- T-0201

## Implementation Checklist

1. `@pos/contracts`: additive payload fields + `SCHEMA_VERSION` bump + round-trip tests.
2. Prisma migration: create `low_stock_alert_state` (RLS), drop `stock_item.low_stock_open`.
3. Rework `applyToItem` edge logic against the new table; thread `opened_at`.
4. Read `alert_config.recipients`; attach `recipients` to the fell-below event.
5. Update `services/inventory/test/*` for the edge, dedupe, recover, re-open, and payload assertions.
6. `pnpm --filter @pos/contracts test`, `pnpm --filter @pos/inventory test`, `pnpm -r build/lint`, `contracts-compat`; validator.

## Verification

- `services/inventory/test/inventory.e2e-spec.ts` asserts the edge state row, dedupe, recover with matching `opened_at`, re-open with new `opened_at`, and `recipients` passthrough.
- `pnpm --filter @pos/contracts test` + `pnpm --filter @pos/inventory test` green; `pnpm -r build` green; contracts-compat green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
