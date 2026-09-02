# T-0108 Mobile — Stock-in + Adjustment

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/interfaces/mobile-app-spec.md` (Stock-in, Adjustment), `docs/design/interfaces/api-contract.md` (`POST /stock/movements`), `docs/design/architecture/mobile-architecture.md`
- Constraints: project Flutter architecture; a stock-in is always positive, an adjustment keeps its sign; server rejects an adjustment below zero (`422 insufficient_stock`) — surface it.
- Do not touch: `web/`, `services/*`.

## Objective

One "Record movement" screen handles both `stock_in` and `adjustment`, reachable from a product's detail screen (product prefixed) or Home (product picker).

## Scope Boundary

**In scope:**
- `lib/features/stock/providers/stock_provider.dart` — `StockProvider extends BaseProvider`, `record(businessId, {productId, type, quantityDelta, reason})` over `CatalogService.recordMovement`; registered in `providers.dart`.
- `lib/features/stock/screens/record_movement_screen.dart` + `RecordMovementArgs` (route `extra`).
- `AppRoute.recordMovement` + top-level `GoRoute`; wired from `ProductDetailScreen` ("Stock in" / "Adjust") and `HomeScreen`.

**Out of scope:**
- Stock / movements list screens on mobile (web `/stock` covers admin; a mobile stock list is backlog).
- `Idempotency-Key` on mobile writes (added when offline queueing lands).

## Acceptance Criteria

- Segmented control switches `stock_in` / `adjustment`; the quantity label + hint change accordingly.
- From a product detail, the product is fixed; from Home, a product picker is shown (required).
- Submitting calls `POST /stock/movements`; on success a SnackBar shows the new on-hand, the catalog's cached `StockItem` is refreshed, and the screen pops.
- A `422 insufficient_stock` (or any API error) renders `ErrorByCodeCard` and does not pop.
- `flutter analyze` clean; imports are `package:pos_mobile/...`.

## Dependencies

- T-0104, T-0105, T-0106

## Implementation Checklist

1. `StockProvider` + register.
2. `record_movement_screen.dart` + `RecordMovementArgs`.
3. `AppRoute.recordMovement` + `GoRoute`; wire detail + home entry points.
4. `flutter analyze` + `flutter test`.

## Verification

- `flutter analyze` → "No issues found!"; `flutter test` → 3 passing.
- Live: stock-in raises on-hand by exactly N; an over-large negative adjustment shows `insufficient_stock`. Exercised against `docker compose up`.
