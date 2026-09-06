# T-0302 Sales — `POST /sales` Reserve → Write → Commit Saga

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md` (Sale saga), `docs/design/interfaces/internal-rpc.md` (`reserveStock` / `commitReservation` / `releaseReservation`), `docs/design/interfaces/api-contract.md` (Sales & receipts, Idempotency), `docs/design/data/data-model.md` (`sale` invariants, `sale_number_counter`, `product_cache`)
- Constraints: the whole sale writes in one tenant transaction (`sale` + `sale_line[]` + `receipt` + `SaleCompleted` outbox row); `reserveStock` is called before that txn and `commitReservation` after it; any failure → `releaseReservation` and no `sale` rows; `Idempotency-Key` replays the original sale (dedupe on `(business_id, idempotency_key)`); `sale.number` from `sale_number_counter` (`SELECT … FOR UPDATE`) inside the txn; line snapshots: `name_snapshot` + `unit_price_snapshot` from the request, else from `product_cache`; totals in integer minor units, `total == sum(line_total) - discount_total`, `total >= 0`; `sales` never writes a `stock_movement`.
- Do not touch: `services/inventory`, `catalog`, `web/`, `mobile/`.

## Objective

Implement `POST /v1/businesses/{businessId}/sales` (Owner/Staff) as the reserve → write → commit saga, plus the `product_cache` consumers that feed line snapshots.

## Scope Boundary

**In scope:**
- `SalesController` `POST /sales` behind `InternalContextGuard` + `TenantGuard` + `RolesGuard('owner','staff')`, `@ApiHeader('Idempotency-Key')`.
- `CreateSaleDto`: `lines: [{ product_id: uuid, quantity: int>0, unit_price?: int>=0, discount?: int>=0 }]` (≥1), `customer_label?`.
- `SalesService.createSale`:
  1. Idempotency replay: prior sale for `(businessId, idempotencyKey)` → return it.
  2. Resolve line snapshots (request value else `product_cache`; 400 `validation_error` if neither has a price/name).
  3. `inventory.reserveStock({ business_id, reservation_id, lines: [{product_id, quantity}] })` — `reservation_id` = a fresh uuid (or derived from the idempotency key). RPC transport failure → `503 upstream_unavailable`.
  4. In one `runInTenantContext` txn: allocate `number`, write `sale` + `sale_line[]` + `receipt` (`public_token` from a ≥128-bit CSPRNG, `business_name_snapshot` + `currency` from the `BusinessCreated` cache), write the `SaleCompleted` outbox row.
  5. `inventory.commitReservation({ business_id, reservation_id, sale_id })`. Failure here → log; `SaleCompleted` is the backstop (inventory commits on the event).
  6. Any failure at step 3–4 → `inventory.releaseReservation`, surface the error, no `sale` rows.
- `ProductCacheConsumer`: `catalog.ProductUpserted` → upsert `product_cache.name`; `catalog.PriceChanged` → upsert `product_cache.sell_price` + `currency`. Idempotent on `event_id`.
- `BusinessCacheConsumer`: `tenancy.BusinessCreated` → store `business` name + currency (small projection or a `sales_business` table) for the receipt snapshot.
- Kong: add `~/v1/businesses/[^/]+/sales` to a new `sales` service route (with `pos-internal-context`) in `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`.
- e2e with `@pos/testing` in-memory bus + a stub `inventory` RPC.

**Out of scope:**
- `422 insufficient_stock` shortfall shaping — T-0303 (built together; this task wires the happy path).
- Void, public receipt, list endpoints — T-0304 / T-0305 / T-0306.

## Acceptance Criteria

- A valid `POST /sales` returns `201` with `{ id, number, status: 'completed', subtotal, discount_total, total, currency, lines: [...], receipt: { public_token } }`; `number` increments per business starting at 1.
- Exactly one `sale`, N `sale_line`, one `receipt`, and one `SaleCompleted` outbox row are written in the same transaction; `sales` writes no `stock_movement`.
- `total == sum(line_total) - discount_total` and `total >= 0`; a line with no `unit_price` and no `product_cache` entry → `400 validation_error`.
- Re-POST with the same `Idempotency-Key` returns the first sale (same `id`, same `number`) and creates no new rows and no second `SaleCompleted`.
- `reserveStock` transport failure → `503`; no `sale` rows, and `releaseReservation` is not required (nothing reserved).
- A failure after `reserveStock` but before commit → `releaseReservation` called once, no `sale` rows.

## Dependencies

- T-0301

## Implementation Checklist

1. DTO + controller + guards + Kong `sales` route.
2. `product_cache` + business-cache consumers.
3. `SalesService.createSale` saga (reserve → txn write → commit; compensation on failure).
4. `sale_number_counter` allocation; snapshot resolution; totals math.
5. e2e: happy path, idempotent replay, price-missing 400, reserve-failure 503, post-reserve failure → release.
6. `pnpm --filter @pos/sales test`, `pnpm -r build/lint`, `kong config parse`; validator.

## Verification

- `services/sales/test/*` covers all acceptance criteria with a stubbed `inventory` RPC.
- `pnpm --filter @pos/sales test` green; `pnpm -r build` green; `kong config parse` OK.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
