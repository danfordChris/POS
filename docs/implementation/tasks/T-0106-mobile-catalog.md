# T-0106 Mobile — Catalog List, Product Detail, Product Form

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/interfaces/mobile-app-spec.md`, `docs/design/interfaces/api-contract.md` (Catalog), `docs/design/architecture/mobile-architecture.md`, `docs/design/interfaces/ui-design-system.md`
- Constraints: follow the project Flutter architecture — `AppRoute` enum routes, `provider` + `BaseProvider`, `<Feature>Service` static over `ApiClient.instance`, feature-first, absolute imports; price fields Owner-only; neumorphic kit only; every failure via `ErrorByCodeCard`.
- Do not touch: `web/`, `services/*`, the auth/shell code beyond wiring routes.

## Objective

`mobile/` shows a live catalog: a searchable product list with on-hand + low badge, a product detail screen, and a create/edit form (price fields Owner-only), all against the `catalog` + `inventory` services through Kong.

## Scope Boundary

**In scope:**
- `lib/features/catalog/providers/catalog_provider.dart` — `CatalogProvider extends BaseProvider` (`products`, `categories`, `stockFor`, `load`/`loadMore`, `save`, `deactivate`, `refreshOne`, `lookupByCode`); registered in `providers.dart`.
- `lib/features/catalog/screens/{catalog_screen.dart, product_detail_screen.dart, product_form_screen.dart}` + `widgets/product_row.dart`.
- `lib/data/services/catalog_service.dart`, `lib/models/catalog_models.dart` (from the earlier pass).
- `AppRoute.{productNew, productDetail, productEdit}` + top-level `GoRoute`s (`parentNavigatorKey: NavigationKeys.root`).
- Home screen wired to the catalog counts + quick actions.

**Out of scope:**
- Camera scan (T-0107); stock-in / adjustment forms (T-0108).
- Product image upload on mobile (web-only per `web-app-spec.md`; backlog for mobile).
- Winger price editing (web-only).

## Acceptance Criteria

- Catalog tab lists products (name, SKU, sell price, on-hand, `low` badge) with a working search that re-queries `?q=`; pull-to-refresh; "Load more" when `next_cursor` is present.
- Tapping a row opens the product detail (passed via `extra`), which refetches on open and shows `cost_price` only when `SessionProvider.isOwner`.
- "New product" and the edit action open `ProductFormScreen`; a Staff user sees no price fields; saving calls `POST`/`PATCH /products` and pops with a confirmation; a `409` renders `ErrorByCodeCard`.
- Deactivate shows a confirm dialog and calls `POST /products/{id}/deactivate`.
- `flutter analyze` reports no issues; `flutter test` passes; all new imports are `package:pos_mobile/...`.

## Dependencies

- T-0102 (catalog API), T-0105 (stock read), T-0121 (mobile shell), T-0119 (design system), mobile architecture refactor

## Implementation Checklist

1. `CatalogProvider` + register in `providers.dart`.
2. `catalog_screen.dart` list with search / refresh / paging; `product_row.dart`.
3. `product_detail_screen.dart` (refetch, role-scoped cost, actions).
4. `product_form_screen.dart` (create/edit, Owner-only prices, category dropdown).
5. `AppRoute` entries + `GoRoute`s; home quick actions.
6. `flutter analyze` + `flutter test`.

## Verification

- `flutter analyze` → "No issues found!"; `flutter test` → 3 passing (boot → sign-in; login fields; theme build).
- Screens consume `CatalogProvider` via `context.watch/select`; no screen calls `CatalogService` or `ApiClient` directly.
- Live catalog CRUD exercised against `docker compose up` (Kong + identity + tenancy + catalog + inventory) on an emulator with `--dart-define=API_BASE_URL=http://10.0.2.2:8000`.
