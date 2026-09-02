# Phase 02 — Inventory Core

## Status

- `done`
- Last updated: 2026-09-02
- Progress: `catalog` (T-0101–T-0103) and `inventory` (T-0104–T-0105) services shipped;
  neumorphic design system (T-0118–T-0119) and web + mobile app shells (T-0120–T-0121)
  in place. All feature screens (T-0106–T-0109) shipped. **`docker compose up`
  brings the full stack (postgres, nats, kong, identity, tenancy, catalog,
  inventory, redis, minio, mailpit) healthy; the end-to-end smoke test passes
  25/25 through Kong** (auth → business → category → product → scan-by-code →
  stock_in/adjustment → insufficient_stock 422 → `/stock` → `/stock/movements` →
  cross-service `ProductUpserted` feeds `reorder_threshold` so `/stock/low` is
  correct → tenant-isolation 403s). Acceptance criteria verified.

## Objective

Deliver catalog management and a stock movement ledger with derived on-hand, plus scan-based item lookup on mobile.

## Scope

- Categories and products CRUD (per `api-contract.md`); price fields Owner-only.
- Product image upload to object storage.
- `stock_item` cache + `stock_movement` append-only ledger (`stock_in`, `adjustment`).
- Derived on-hand; transactional invariant `quantity == sum(quantity_delta)`.
- `GET /stock`, `GET /stock/movements`, `GET /stock/low`.
- Mobile: catalog list/detail, new/edit product, scan screen, stock-in, adjustment.
- Web: catalog table, product form, stock and movements views, CSV export.

## Features

- Search products by name, SKU, or scanned `code`.
- Scan unknown code → new product form prefilled with `code`.

## Tasks

- [x] T-0101 Category + product model, migration, RLS
- [x] T-0102 Product endpoints + role-aware DTO (Staff hides cost)
- [x] T-0103 Image upload adapter + endpoint
- [x] T-0104 Stock ledger model + movement endpoint (transactional on-hand)
- [x] T-0105 Stock read endpoints (on-hand, movements, low)
- [x] T-0106 Mobile catalog + product form
- [x] T-0107 Mobile scan screen + lookup/prefill (camera capture deferred — backlog)
- [x] T-0108 Mobile stock-in + adjustment flows
- [x] T-0109 Web catalog + stock + movements + CSV

### Client foundation (unblocks T-0106–T-0109)

- [x] T-0118 Web neumorphic design system foundation (tokens, theme provider, base component kit)
- [x] T-0119 Mobile neumorphic design system foundation (token classes, ThemeData, base widget kit)
- [x] T-0120 Web app shell (auth, session, proxy refresh, sidebar/header nav, route + role guards)
- [x] T-0121 Mobile app shell (auth, SessionController, go_router redirect, bottom nav)
- Design system of record: `docs/design/interfaces/ui-design-system.md` (adopts the
  `design_handoff_neumorphic_system/` tokens + component rules; not its screen mockups).
- Two API gaps surfaced by the shells, tracked in `tasks/backlog.md`: no
  `GET /v1/businesses` list (forces onboarding, blocks the business switcher) and
  `GET /v1/auth/me` returns empty `memberships`.

## Acceptance Criteria

- [x] Recording `stock_in` of N increases on-hand by exactly N and writes one movement row.
- [x] Randomized movement sequences keep `stock_item.quantity == sum(stock_movement.quantity_delta)`.
      (covered by `inventory` service tests + the live smoke sequence 0→20→15→3.)
- [x] Staff product responses contain no `cost_price`. (owner sees `cost_price`; verified live.)
- [x] Scan of a known code returns the product; unknown returns 404 echoing the code.
- [x] `GET /stock/low` returns exactly the products with on-hand ≤ `reorder_threshold`.

## Blockers

- Phase 01 (Platform) must be `done`: `identity` + `tenancy` services live, gateway routing + membership resolution, NATS, `@pos/nest-common`, `@pos/contracts`.
- This phase adds the `catalog` and `inventory` services.

## Linked Tasks

- `docs/implementation/tasks/`
