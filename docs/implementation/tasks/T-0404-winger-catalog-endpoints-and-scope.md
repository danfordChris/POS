# T-0404 Winger Catalog Endpoints + Whitelist DTO + Scope/Suspension Enforcement

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 05 — Winger Portal

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (Winger section + whitelist note), `docs/design/product/roles-and-permissions.md` (winger price resolution, `in_stock` boolean only, suspended → 403, no non-winger routes), `docs/design/data/data-model.md` (`winger_catalog_projection`, `winger_price` fallback)
- Constraints: `/v1/winger/*` carries a verified user context with **no** membership scope — the `winger` service authorizes every call against its own `winger_account` (`active`) rows; response is a fixed whitelist `{ name, image_url, price, currency, in_stock }` with a schema test asserting no extra keys; `price = winger_price ?? sell_price`; `in_stock = on_hand > 0` and the raw number never leaves the service; reads are `runInTenantContext(business_id-from-path)` only after authorization passes.
- Do not touch: `winger_account` mutation endpoints (T-0402); projection consumers (T-0403); `web/`, `mobile/`.

## Objective

Ship `GET /v1/winger/businesses` and `GET /v1/winger/businesses/{businessId}/products` returning only the whitelisted fields, with non-authorized and suspended callers rejected with `403`.

## Scope Boundary

**In scope:**
- `services/winger`: `WingerCatalogController` + `WingerCatalogService`:
  - `GET /v1/winger/businesses` — read `winger_account WHERE user_id = <ctx.user_id> AND status = 'active'`; return `[{ business_id, business_name }]` (business name from a small `winger_business` projection fed by `WingerAuthorized` or a `BusinessCreated` consumer — add the consumer here if not present). A `suspended`-only caller gets `[]`; a caller with no accounts gets `[]`.
  - `GET /v1/winger/businesses/{businessId}/products` — require an `active` `winger_account` for `(businessId, ctx.user_id)`; else `403 winger_scope_denied`. If the account is `suspended` → `403`. On success, read `winger_catalog_projection WHERE is_active AND sell_price IS NOT NULL`, map to `{ name, image_url, price: winger_price ?? sell_price, currency, in_stock: on_hand > 0 }`, cursor-paginated.
- Response zod schema in the service (or `@pos/contracts` if a shared schema fits) + a schema test asserting the object has exactly those five keys.
- Kong: new route for `/v1/winger/*` → `winger` service with `pos-internal-context` and `require_business_scope: false` (declarative `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`). The `/v1/businesses/*` winger route from T-0402 is unchanged.
- e2e specs.

**Out of scope:**
- `WingerSuspended` cache-bust at the edge beyond removing `require_business_scope` (membership cache does not cover winger routes).
- Web/mobile clients — T-0405/T-0406.

## Acceptance Criteria

- `GET /v1/winger/businesses/{id}/products` for an `active` winger returns `200`; every element has exactly `{ name, image_url, price, currency, in_stock }` — the schema test fails if `on_hand`, `quantity`, `sku`, `cost_price`, or `created_by` appear.
- `GET /v1/winger/businesses/{id}/products` for a `business_id` the caller has no `active` account for returns `403 winger_scope_denied`.
- The same call for a `suspended` account returns `403`.
- `GET /v1/winger/businesses` lists only businesses where the caller's account is `active`; suspended/absent → not listed.
- For a product with `winger_price = null`, `price` equals `sell_price`; with `winger_price` set, `price` equals `winger_price`.
- `in_stock` is `true` for `on_hand = 1`, `false` for `on_hand = 0`; no numeric quantity in the payload.
- `kubectl kustomize infra/k8s/base` renders the `/v1/winger/*` route; `docker compose config` valid.
- A non-winger route (e.g. `GET /v1/winger/../sales`) is not registered — `404`.

## Dependencies

- T-0401 (scaffold), T-0402 (`winger_account` rows), T-0403 (`winger_catalog_projection` populated).

## Implementation Checklist

1. `winger_business` projection + `WingerAuthorized` / `BusinessCreated` consumer for business names (if absent).
2. `WingerCatalogService` — authorization against `winger_account`, projection read + whitelist mapping.
3. `WingerCatalogController` — the two GET routes + cursor pagination + response DTO.
4. Response schema + schema test (exact-keys assertion).
5. Kong `/v1/winger/*` route (`require_business_scope: false`) in both config files.
6. e2e specs; `pnpm -r build/test/lint`; `kustomize`; `docker compose config`; validator.

## Verification

Run and capture:

- `pnpm --filter @pos/winger test` — whitelist schema test, scope `403`, suspended `403`, price fallback, `in_stock` boolean, `businesses` listing.
- `kubectl kustomize infra/k8s/base | grep -A5 winger`; `docker compose -f infra/docker-compose.yml config`.
- Live smoke through Kong: authorize a winger (T-0402), then `GET /v1/winger/businesses` and `GET /v1/winger/businesses/{id}/products` with that winger's token; suspend and confirm `403`.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
