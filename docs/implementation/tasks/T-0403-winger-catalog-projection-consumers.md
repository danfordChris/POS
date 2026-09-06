# T-0403 Winger Catalog Projection — Event Consumers + `image_url` on `ProductUpserted`

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 05 — Winger Portal

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/events-catalog.md` (`ProductUpserted`, `PriceChanged`, `ProductDeactivated`, `StockLevelChanged`), `docs/design/data/data-model.md` (`winger_catalog_projection`), `docs/design/architecture/service-decomposition.md` (denormalized copies rebuilt from events)
- Constraints: consumers idempotent on `event_id` via `processed_events`; use `subscribeWithDlq` with a durable name + `dlqSubject` per subject; all writes tenant-scoped through `runInTenantContext`; the projection is a pure read cache — never the source of truth; `image_url` addition to `ProductUpserted` is additive (`z.string().nullable().optional()`); `catalog` change is limited to the emit path.
- Do not touch: `winger_account` and its endpoints (T-0402); winger catalog HTTP endpoints (T-0404); `services/inventory` internals (it already emits `StockLevelChanged`); `web/`, `mobile/`.

## Objective

Populate `winger_catalog_projection` from catalog and inventory events so a winger catalog read needs no cross-service call, including product images.

## Scope Boundary

**In scope:**
- `@pos/contracts`: add `image_url` (nullable, optional) to `productUpsertedPayload`; update the round-trip test.
- `services/catalog`: include `image_url` in the `ProductUpserted` payload it emits; emit `ProductUpserted` after a successful product-image upload (the endpoint added in Phase 02 T-0103) so the new URL propagates. No new event type.
- `services/winger` consumers, each idempotent on `event_id`, each with a DLQ subject:
  - `ProductUpserted` → upsert `(business_id, product_id)` row: `name`, `image_url`, `is_active`. Seed `sell_price`/`winger_price`/`currency` absent until a `PriceChanged` arrives (nullable / 0 default; row still listed only when `is_active` and a price is known — see T-0404 filter).
  - `PriceChanged` → set `sell_price`, `winger_price`, `currency`.
  - `ProductDeactivated` → set `is_active = false`.
  - `StockLevelChanged` → set `on_hand`.
- Consumer registration in the winger app module; e2e specs with the InMemoryBus.

**Out of scope:**
- The `GET /v1/winger/...` endpoints that read this projection — T-0404.
- Any change to how `inventory` computes stock.

## Acceptance Criteria

- `productUpsertedPayload` accepts a payload with `image_url` and one without; `node scripts/check-contracts-compat.mjs HEAD` → OK.
- After `ProductUpserted` then `PriceChanged` then `StockLevelChanged` for one product, the projection row has `name`, `image_url`, `sell_price`, `winger_price`, `currency`, `on_hand` set.
- Re-delivering any of the four events with the same `event_id` produces no second state change (idempotency spec).
- `ProductDeactivated` sets `is_active = false` on the row.
- Uploading a product image in `catalog` emits `ProductUpserted` carrying the new `image_url` (catalog spec).
- A poisoned event lands on its `dlqSubject` after max-deliver, not an infinite retry.
- Projection writes for business A are invisible to an unscoped `count()` (forced RLS spec).

## Dependencies

- T-0401 (`winger_catalog_projection` model + winger scaffold).

## Implementation Checklist

1. `@pos/contracts`: `image_url` on `productUpsertedPayload` + test.
2. `services/catalog`: emit `image_url`; emit `ProductUpserted` on image upload.
3. `services/winger`: four consumers + module registration.
4. e2e specs: population, idempotency, deactivation, DLQ, RLS.
5. `pnpm -r build/test/lint`; `check-contracts-compat.mjs`; validator.

## Verification

Run and capture:

- `pnpm --filter @pos/contracts test`; `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `pnpm --filter @pos/catalog test` — image upload emits `ProductUpserted` with `image_url`.
- `pnpm --filter @pos/winger test` — projection population + idempotency + deactivation + DLQ + RLS specs.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
