# T-0307 Mobile — Sell Flow

## Status

- `pending`
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

- `mobile/test/*` — a widget test covering the running total and the `insufficient_stock` inline state.
- `cd mobile && flutter analyze` → no issues; `flutter test` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
