# Phase 05 — Winger Portal

## Status

- `pending`
- Last updated: 2026-09-07

## Objective

Let an Owner authorize resellers ("wingers") who then see a fixed-whitelist catalog view — winger pricing, in-stock boolean, no numbers — for exactly the businesses that authorized them and nothing else.

## Scope

- New `services/winger` (schema `winger`, role `winger_app`) cloned from the `services/sales` shape: `@pos/nest-common` bootstrap, `PlatformModule` NATS `name: 'winger'`, `outbox` + `processed_events`, `OutboxRelayService`, `/healthz` + `/readyz`, Dockerfile, compose + k8s manifests, CI matrix entry.
- `winger_account` model + migration + forced RLS; unique `(business_id, user_id)`; mutually exclusive with `membership` (checked via `tenancy.resolveMembership`).
- `winger_catalog_projection` model + migration + forced RLS; unique `(business_id, product_id)`; rebuilt from `ProductUpserted` / `PriceChanged` / `ProductDeactivated` / `StockLevelChanged`.
- `@pos/contracts` (additive, `SCHEMA_VERSION` minor bump): `SUBJECTS.winger`, `wingerAuthorizedPayload`, `wingerSuspendedPayload`; `image_url?` added to `productUpsertedPayload`.
- `catalog`: include `image_url` in `ProductUpserted`, and emit `ProductUpserted` after a successful product-image upload.
- `identity`: `getUser` RPC accepts `create: true` → provisions a passwordless shell user when an `email`/`phone` matches nobody.
- `POST/GET/PATCH /v1/businesses/{id}/winger-accounts` (Owner) — resolve-or-create the user, reject a user who already has a `membership` there (`409`), emit `WingerAuthorized` / `WingerSuspended` via the outbox.
- `GET /v1/winger/businesses` and `GET /v1/winger/businesses/{id}/products` (verified user context, no membership scope) — the service authorizes each call against its own `winger_account` rows.
- Winger product DTO: fixed whitelist `{ name, image_url, price, currency, in_stock }`; `price = winger_price ?? sell_price`; `in_stock = on_hand > 0` (the number is never returned). A schema test asserts no extra fields.
- Non-authorized `business_id` → `403 winger_scope_denied`; `suspended` account → `403` on every winger route.
- Kong: `/v1/businesses/{id}/winger-accounts` on the standard business-scoped route; `/v1/winger/*` on a new route with `pos-internal-context` but `require_business_scope: false` (declarative `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`).
- Web `/wingers`: authorize, list, suspend/reactivate; set per-product `winger_price`; upload product images.
- Mobile: winger-only catalog view + business switcher; a winger session registers no non-winger routes.
- `notifications`: `WingerAuthorized` consumer → `notification` row → `winger_authorized` email template (en/sw).

## Features

- Winger price left blank falls back to retail `sell_price` at read time.
- Placeholder image when `image_url` is null (client-side).

## Design Notes (gap-fills adopted 2026-09-07)

- `winger_catalog_projection` columns are defined in `docs/design/data/data-model.md`.
- `ProductUpserted` carries `image_url?` (`docs/design/interfaces/events-catalog.md`); `catalog` emits it on image change.
- `identity.getUser` gains `create?` (`docs/design/interfaces/internal-rpc.md`).
- `winger → tenancy.resolveMembership` for member/winger mutual exclusion (`docs/design/interfaces/internal-rpc.md`, `docs/design/architecture/service-decomposition.md`).
- `/v1/winger/*` is authorized in the `winger` service, not by Kong membership (`docs/design/interfaces/api-contract.md`).

## Tasks

- [x] T-0401 `winger` service scaffold + `winger_account` model + migration + RLS + winger contracts
- [x] T-0402 Owner winger-account endpoints + user resolve-or-create + `identity.getUser { create }` + mutual-exclusion check + `WingerAuthorized` / `WingerSuspended`
- [ ] T-0403 `winger_catalog_projection` + catalog/inventory event consumers + `image_url` on `ProductUpserted` + catalog emits on image change
- [ ] T-0404 Winger catalog endpoints + whitelist DTO + schema test + scope/suspension enforcement + Kong `/v1/winger/*` route
- [ ] T-0405 Web `/wingers` management + per-product winger price + product image upload
- [ ] T-0406 Mobile winger catalog + business switcher (restricted routing)
- [ ] T-0407 `winger_authorized` email template (en/sw) + `notifications` `WingerAuthorized` consumer

## Acceptance Criteria

- [ ] `GET /v1/winger/businesses/{id}/products` response validates against the whitelist schema — no `quantity`, `on_hand`, `cost_price`, `created_by`, `sku`, or member fields.
- [ ] A winger request for a `business_id` the caller has no `active` `winger_account` for returns `403 winger_scope_denied`.
- [ ] A `suspended` winger gets `403` on `GET /v1/winger/businesses` and `GET /v1/winger/businesses/{id}/products`.
- [ ] `price` equals `winger_price` when set on the product, else `sell_price`.
- [ ] `in_stock` is `true` iff `on_hand > 0`; no numeric quantity appears in the response.
- [ ] `POST /v1/businesses/{id}/winger-accounts` for a user who has a `membership` in that business returns `409`.
- [ ] `POST /v1/businesses/{id}/winger-accounts` with an unknown `email` provisions a user and returns the account; a `WingerAuthorized` event is published.
- [ ] `PATCH .../winger-accounts/{id}` to `suspended` publishes `WingerSuspended`.
- [ ] A winger authorization produces one `notification` row of type `winger_authorized`; the template renders in `en` and `sw`.
- [ ] `node scripts/check-contracts-compat.mjs HEAD` → OK (all contract changes additive).

## Blockers

- Phase 02 (`catalog` + `inventory`) `done` — satisfied.

## Linked Tasks

- `docs/implementation/tasks/T-0401-*.md` … `T-0407-*.md`
