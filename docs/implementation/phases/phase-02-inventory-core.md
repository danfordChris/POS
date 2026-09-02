# Phase 02 — Inventory Core

## Status

- `in-progress`
- Last updated: 2026-09-02
- Progress: `catalog` service shipped (T-0101–T-0103). `inventory` service + mobile/web
  screens (T-0104–T-0109) remain.

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
- [ ] T-0104 Stock ledger model + movement endpoint (transactional on-hand)
- [ ] T-0105 Stock read endpoints (on-hand, movements, low)
- [ ] T-0106 Mobile catalog + product form
- [ ] T-0107 Mobile scan screen + lookup/prefill
- [ ] T-0108 Mobile stock-in + adjustment flows
- [ ] T-0109 Web catalog + stock + movements + CSV

### Client foundation (unblocks T-0106–T-0109)

- [x] T-0118 Web neumorphic design system foundation (tokens, theme provider, base component kit)
- [x] T-0119 Mobile neumorphic design system foundation (token classes, ThemeData, base widget kit)
- Design system of record: `docs/design/interfaces/ui-design-system.md` (adopts the
  `design_handoff_neumorphic_system/` tokens + component rules; not its screen mockups).

## Acceptance Criteria

- [ ] Recording `stock_in` of N increases on-hand by exactly N and writes one movement row.
- [ ] Randomized movement sequences keep `stock_item.quantity == sum(stock_movement.quantity_delta)`.
- [ ] Staff product responses contain no `cost_price`.
- [ ] Scan of a known code returns the product; unknown returns 404 echoing the code.
- [ ] `GET /stock/low` returns exactly the products with on-hand ≤ `reorder_threshold`.

## Blockers

- Phase 01 (Platform) must be `done`: `identity` + `tenancy` services live, gateway routing + membership resolution, NATS, `@pos/nest-common`, `@pos/contracts`.
- This phase adds the `catalog` and `inventory` services.

## Linked Tasks

- `docs/implementation/tasks/`
