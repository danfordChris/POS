# T-0104 Inventory Service — Stock Ledger + Movement Endpoint

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/data/data-model.md`, `docs/design/interfaces/api-contract.md`, `docs/design/interfaces/events-catalog.md`, `docs/design/interfaces/internal-rpc.md`
- Constraints: `stock_item.quantity == sum(stock_movement.quantity_delta)` must hold in every transaction; the ledger is append-only; inventory does not read another service's schema (it learns `reorder_threshold` from `ProductUpserted`); every producer emits via the transactional outbox; every consumer/RPC is idempotent; wrap fallible I/O in try/catch.
- Do not touch: `services/catalog` domain logic beyond the `ProductUpserted` payload field; `services/identity`, `services/tenancy`.

## Objective

Stand up `services/inventory` (`@pos/inventory`) with `stock_item`, `stock_movement`, `stock_reservation` (RLS) and `POST /v1/businesses/{businessId}/stock/movements` that records a `stock_in`/`adjustment` and moves cached on-hand in the same transaction, emitting the `Stock*` events.

## Scope Boundary

**In scope:**
- `services/inventory/` scaffold mirroring `services/catalog/` (config, prisma, platform, tenant guards, health, Dockerfile).
- `prisma/schema.prisma`: `StockItem`, `StockMovement` (append-only, `idempotency_key` unique per business), `StockReservation`, `OutboxMessage`, `ProcessedEvent`; migration enables + forces RLS on the three tenant tables.
- `src/stock/`: `StockService.recordMovement`, `StockController` `POST /stock/movements` (`Idempotency-Key` header), DTOs, views.
- `src/consumers/product-events.consumer.ts`: `catalog.ProductUpserted` seeds `stock_item` + tracks `reorder_threshold`/active; `catalog.ProductDeactivated` clears active. Idempotent on `event_id`.
- `src/rpc/inventory.rpc.ts`: `reserveStock` / `commitReservation` / `releaseReservation` handlers (T-0105 completes their read side but the saga lives here).
- `@pos/contracts`: `SUBJECTS.inventory.stockMovementRecorded` + `stockRecovered`; `stockMovementRecordedPayload`, `stockLevelChangedPayload`, `stockRecoveredPayload`; `commitReservation` / `releaseReservation` RPC pairs; `ProductUpserted` payload gains `reorder_threshold`.
- `events-catalog.md` `ProductUpserted` row updated; catalog emitter updated.
- Kong `inventory` route (`~/v1/businesses/[^/]+/stock`), compose, `infra/k8s/base/inventory.yaml` + kustomization + secret, CI matrix, `.env.example` `INVENTORY_PORT`.

**Out of scope:**
- `GET /stock`, `/stock/movements`, `/stock/low` bodies — T-0105 (built together in this pass).
- Sale/void movement wiring from a real `sales` service — Phase 04.
- Multi-location.

## Acceptance Criteria

- Recording a `stock_in` of N raises `stock_item.quantity` by exactly N and writes one `stock_movement` row.
- A randomized sequence of `stock_in`/`adjustment` keeps `stock_item.quantity == sum(stock_movement.quantity_delta)`.
- An `adjustment` that would make on-hand negative returns 422 `insufficient_stock`; a `stock_in` with `quantity_delta <= 0` returns 400 `validation_error`.
- Re-sending `POST /stock/movements` with the same `Idempotency-Key` returns the first movement and does not change on-hand.
- Each movement emits `StockMovementRecorded` + `StockLevelChanged`; crossing the reorder threshold downward emits `StockFellBelowThreshold`, recovering above it emits `StockRecovered` (once per edge).
- `ProductUpserted` twice (same `event_id`) creates one `stock_item` and one `processed_events` row; `ProductDeactivated` sets `product_active = false`.
- `\d+ stock_item` / `stock_movement` / `stock_reservation` show RLS enabled + forced; business B sees none of business A's stock.
- `kong config parse` + `kubectl kustomize infra/k8s/base` succeed; `validate_workflow.py` → `WORKFLOW:ok`.

## Dependencies

- T-0101, T-0102, T-0111, T-0112, T-0113, T-0114, T-0115

## Implementation Checklist

1. Extend `@pos/contracts` (subjects, events, rpc) + `events-catalog.md` + catalog emitter with `reorder_threshold` and the inventory events/RPC.
2. Scaffold `services/inventory`; write the Prisma schema + init migration with RLS on the three tables.
3. `StockService` — `recordMovement` in one `runInTenantContext` tx: idempotency pre-check → `ensureItem` → validate → insert movement → move quantity → emit events (with low-stock edge).
4. `StockController` `POST /stock/movements`; `ProductEventsConsumer`; `InventoryRpc` skeleton.
5. Kong route, compose, k8s, CI, `.env.example`.
6. e2e spec; `pnpm -r build/test/lint/format`; validator.

## Verification

- `services/inventory/test/inventory.e2e-spec.ts` — 11 tests: stock_in exact delta + one row, randomized-sequence invariant (Prisma `aggregate` vs cached quantity), below-zero 422, `Idempotency-Key` replay (one row), `/stock/low` membership, `ProductUpserted` seed + idempotency, `ProductDeactivated`, reserve→commit→(idempotent) with a `sale` movement, release idempotency + committed-can't-release, operator 403, tenant isolation.
- `pnpm -r build` + `pnpm -r test` green — 66 tests (contracts 7, testing 5, nest-common 16, inventory 11, catalog 11, tenancy 9, identity 7).
- `kong config parse infra/kong/kong.yml` → `parse successful`; `kubectl kustomize infra/k8s/base` → exit 0; `docker compose config -q` valid.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
