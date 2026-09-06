# T-0406 Mobile Winger Catalog + Business Switcher (Restricted Routing)

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 05 — Winger Portal

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (`GET /v1/winger/businesses`, `GET /v1/winger/businesses/{id}/products`), `docs/design/product/roles-and-permissions.md` (winger has no access to any non-winger route; `in_stock` boolean; winger price)
- Constraints: Flutter, `provider` + local `BaseProvider` (`guard<T>()`, `isBusy`, `error`); static service class over `ApiClient.instance`; `AppRoute` enum routing (go_router); neumorphic `Neu*` widgets; `formatMoney(minor, currency)`; feature-first under `lib/features/winger/`; absolute `package:pos_mobile/...` imports; a winger session MUST register only winger routes + auth — no sell/inventory/alerts routes in the router tree for that session.
- Do not touch: `services/*`; `web/`; the existing owner/staff feature routes (gate them, don't delete).

## Objective

A winger who signs in on the mobile app sees only a business switcher and a read-only catalog (`name`, image or placeholder, winger price, in-stock chip) — and no other screen is reachable.

## Scope Boundary

**In scope:**
- `mobile/lib/models/winger_models.dart` — `WingerBusiness { businessId, businessName }`, `WingerProduct { name, imageUrl?, price (minor), currency, inStock }`.
- `mobile/lib/data/services/winger_service.dart` — `listBusinesses()` → `GET /v1/winger/businesses`; `listProducts(businessId, {cursor})` → `GET /v1/winger/businesses/{id}/products`.
- `mobile/lib/features/winger/providers/winger_provider.dart` — holds the business list, the selected `businessId` (persisted), and the paged product list; `guard`-wrapped loads.
- `mobile/lib/features/winger/screens/winger_catalog_screen.dart` — app bar with a business switcher (dropdown/bottom sheet), product grid/list with a placeholder image when `imageUrl` is null, `formatMoney` price, an "In stock" / "Out of stock" `NeuBadge`; `ErrorByCodeCard` on failure; pull-to-refresh + "Load more".
- Routing: `AppRoute.wingerCatalog` (`/winger`); after login, when the session's role is `winger`, the router exposes only `/winger` (+ auth/splash) and redirects everything else to `/winger`. Owner/staff routing unchanged.
- Role detection from the existing session/`/auth/me` payload (winger accounts array).
- Tests: `winger_provider_test.dart` (business switch reloads products; pagination appends) and a widget test for the catalog screen (placeholder image, in-stock chip, price).

**Out of scope:**
- Any winger write action (there are none).
- Web management UI — T-0405.

## Acceptance Criteria

- A session whose role is `winger` can reach `/winger` and nothing else — navigating to `/sell` or `/inventory` redirects to `/winger` (router test).
- `winger_catalog_screen` renders one card per product with `formatMoney(price, currency)` and an "In stock"/"Out of stock" chip driven by `inStock`.
- A product with `imageUrl == null` shows the placeholder asset, not a broken image.
- Switching the selected business in the app bar triggers `listProducts` for the new `businessId` and replaces the list.
- "Load more" appends the next page using the cursor.
- A `403` from the products call renders `ErrorByCodeCard` (e.g. account suspended) rather than an empty list.
- `flutter analyze` clean; `flutter test` green.

## Dependencies

- T-0404 (winger catalog endpoints live).

## Implementation Checklist

1. `winger_models.dart` + `winger_service.dart`.
2. `winger_provider.dart` — businesses, selection (persisted), paged products.
3. `winger_catalog_screen.dart` — switcher + list + placeholder + in-stock chip.
4. Router: `AppRoute.wingerCatalog`; winger-role guard restricting the route tree.
5. Placeholder image asset (reuse an existing one if present).
6. Tests; `flutter analyze`; `flutter test`; validator.

## Verification

Run and capture:

- `cd mobile && flutter analyze` — clean.
- `cd mobile && flutter test` — provider + widget + router-restriction tests green.
- Manual run against a local stack with a winger account: switcher lists authorized businesses, catalog shows winger prices + in-stock chips, other routes unreachable.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
