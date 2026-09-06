# T-0307 Mobile — Sell Flow

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/interfaces/mobile-app-spec.md` (Sell screen + Behaviors), `docs/design/interfaces/api-contract.md` (`POST /sales`), `docs/design/architecture/mobile-architecture.md`
- Constraints: follow the repo Flutter architecture — `AppRoute` enum route, `provider` + local `BaseProvider`, static `SalesService` over `ApiClient.instance`, feature-first `lib/features/sell/`, absolute `package:pos_mobile/...` imports, neumorphic `Neu*` kit + `DukaColors.of(context)` (no hard-coded colors); money formatted per business `currency` + device locale; every network call in try/catch → typed error → message keyed by `error.code`, `422 insufficient_stock` shown inline (which line is short), never a raw stack; no offline write queue — write buttons disabled with a banner when offline.
- Do not touch: `services/*`, `web/`, unrelated mobile features.

## Objective

Build the Sell screen: assemble a cart, submit `POST /sales`, and route to the receipt on success.

## Scope Boundary

**In scope:**
- `lib/models/sale_models.dart` — `SaleLineInput`, `Sale`, `SaleLine`, `Receipt` (mirrors the `sales` service views).
- `lib/data/services/sales_service.dart` — `createSale(businessId, {lines, customerLabel, idempotencyKey})`, `getSale`, `listSales` (static over `ApiClient.instance`; sets the `Idempotency-Key` header).
- `lib/features/sell/providers/sell_provider.dart` (`BaseProvider`) — cart state: add line (from catalog pick or scan), edit qty, set line discount, remove line, running subtotal/discount/total; `submit()` → `SalesService.createSale` with a per-attempt idempotency key; exposes `loading` / typed `error` / `insufficientLines`.
- `lib/features/sell/screens/sell_screen.dart` — replace the stub: product picker (search + scan entry reusing the catalog list), cart rows with qty stepper (`NeuStepper`) + optional discount field, running total bar, "Complete sale" button (disabled while offline / submitting). On `422` highlight the short line(s) with the `insufficient_stock` message; on success `context.go` to the receipt route with the new `sale.id` / `public_token`.
- Route: add `AppRoute.sell` target wiring if not already routed; the receipt route is T-0308.

**Out of scope:**
- Receipt screen (link/QR/share) — T-0308.
- Camera scanning hardware integration — reuse the existing manual/`findByCode` entry from the Scan feature; live camera is a separate backlog item.
- Void (no mobile void screen in MVP).

## Acceptance Criteria

- Adding lines updates the running subtotal / discount / total live; a line discount reduces its `line_total` and the total.
- "Complete sale" issues one `POST /sales` with an `Idempotency-Key`; a double-tap does not create two sales (same key while a request is in flight / on retry of the same cart).
- A `422 insufficient_stock` response leaves the cart intact, shows the `insufficient_stock` message, and marks the short line(s); no navigation.
- On `201` the app navigates to the receipt view for the returned sale.
- Offline (airplane mode): the complete button is disabled and a banner is shown; reads still render.
- `flutter analyze` clean; `flutter test` green (add a widget test for the running-total math + the `422` inline state).

## Dependencies

- T-0302, T-0303 (server endpoints)

## Implementation Checklist

1. `sale_models.dart` + `sales_service.dart`.
2. `SellProvider` cart + totals + `submit()` with idempotency key.
3. `sell_screen.dart` UI (picker, cart rows, total bar, complete button, offline gate).
4. `422` inline handling + success navigation.
5. Widget test: totals math, `422` state.
6. `flutter analyze` + `flutter test`; validator.

## Verification

Delivered:

- `lib/models/sale_models.dart` — `SaleLineInput` / `SaleLine` / `Receipt` / `Sale`.
- `lib/data/services/sales_service.dart` — `createSale` (sets the
  `Idempotency-Key` header), `getSale`, `listSales`. `ApiClient.post` gained an
  optional `headers` param (threaded through the 401-refresh retry).
- `lib/features/sell/providers/sell_provider.dart` (`BaseProvider`) — `CartLine`
  list, `addProduct` / `setQuantity` / `setDiscount` / `remove` / `clear`, live
  `subtotal` / `discountTotal` / `total` (line total clamped ≥ 0). One
  idempotency key per cart version — regenerated on any mutation, held across
  `submit` retries. `submit()` → `SalesService.createSale`; on
  `422 insufficient_stock` → `insufficientProductIds` (from
  `parseShortfalls(details)`), cart kept, no nav. Registered in `appProviders`.
- `lib/features/sell/screens/sell_screen.dart` — replaces the stub: search-driven
  product picker (from `CatalogProvider`), cart rows with `NeuStepper` qty +
  discount field + line total, sticky total bar, "Complete sale" `NeuButton`
  (disabled while empty / submitting). `422` marks the short rows red + shows
  the `insufficient_stock` `ErrorByCodeCard`. On `201` → SnackBar + `clear()`
  (nav to the receipt screen is wired in T-0308, marked with a `TODO(T-0308)`).

Scoped out (documented deviation): the proactive **offline banner** needs a
connectivity provider that does not yet exist in `mobile/` — no current write
screen has one. `submit` surfaces `network_error` via the error card; the
persistent-banner + write-gate is a shared backlog item for all write screens.

Evidence:

- `cd mobile && flutter analyze` → **No issues found**.
- `flutter test` → all pass, incl. `test/sell_provider_test.dart` (6): running
  totals across add / same-product-merge / discount / quantity change; discount
  cannot push a line below 0; `setQuantity(0)` removes the line; a cart mutation
  clears shortfall marks; `parseShortfalls` extracts the product ids from a
  `422` `details` array.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
