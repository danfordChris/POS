# API Contract — MVP

## Context

- This is the **edge (Kong) public contract** — the only externally reachable API. Internal service subjects are in `events-catalog.md` / `internal-rpc.md`.
- REST over HTTPS. Base path `/v1`. JSON only. OpenAPI document composed by the gateway from downstream service contributions.
- Auth: `Authorization: Bearer <JWT>`. Access token ~15 min, refresh token ~30 days, rotating.
- Two token audiences: `user` and `operator`. A token of the wrong audience on a route → 401.
- Tenant routes are path-scoped: `/v1/businesses/{businessId}/...`. Membership is checked per request.

## Requirements

### Conventions

- IDs are UUID. Money fields: integer minor units + sibling `currency` (ISO 4217).
- Timestamps ISO 8601 UTC.
- Pagination: `?limit=` (default 25, max 100) + `?cursor=`; response `{ data: [...], next_cursor }`.
- Idempotency: `POST /sales` and `POST /stock/movements` accept `Idempotency-Key` header.

### Error model

```json
{
  "error": {
    "code": "string",
    "message": "string",       // user-friendly, safe to show end-users
    "devMessage": "string",    // technical detail for developers/logs (no stack, no secrets)
    "details": [ { "field": "string", "issue": "string" } ]
  },
  "requestId": "string"
}
```

| HTTP | `code` examples |
|---|---|
| 400 | `validation_error`, `image_too_large`, `unsupported_image_type` |
| 401 | `unauthenticated`, `wrong_token_audience` |
| 403 | `not_a_member`, `role_forbidden`, `winger_scope_denied`, `operator_data_access_denied` |
| 404 | `not_found` (body echoes the looked-up key, e.g. scanned `code`) |
| 409 | `conflict` (duplicate SKU/code, version conflict) |
| 410 | `invitation_expired` |
| 422 | `insufficient_stock` |
| 429 | `rate_limited` |

### Endpoints

#### Auth (`/v1/auth`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create a `user` (name, email/phone, password) |
| POST | `/auth/login` | Return access + refresh tokens |
| POST | `/auth/refresh` | Rotate tokens |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/auth/me` | Current user + memberships + winger accounts |

#### Businesses & members

| Method | Path | Role |
|---|---|---|
| POST | `/businesses` | any user → becomes Owner |
| GET | `/businesses/{businessId}` | member |
| PATCH | `/businesses/{businessId}` | Owner |
| GET | `/businesses/{businessId}/members` | Owner |
| PATCH | `/businesses/{businessId}/members/{userId}` | Owner (suspend/remove) |
| POST | `/businesses/{businessId}/invitations` | Owner |
| GET | `/businesses/{businessId}/invitations` | Owner |
| POST | `/businesses/{businessId}/invitations/{id}/revoke` | Owner |
| POST | `/invitations/accept` | authenticated invitee (body: token) |

#### Catalog

| Method | Path | Role |
|---|---|---|
| GET | `/businesses/{businessId}/categories` | member |
| POST | `/businesses/{businessId}/categories` | Owner, Staff |
| GET | `/businesses/{businessId}/products` | member; `?q=` `?code=` `?category_id=` `?active=` |
| POST | `/businesses/{businessId}/products` | Owner, Staff (price fields Owner-only; ignored/403 for Staff) |
| GET | `/businesses/{businessId}/products/{id}` | member |
| PATCH | `/businesses/{businessId}/products/{id}` | Owner, Staff (price fields Owner-only) |
| POST | `/businesses/{businessId}/products/{id}/image` | Owner, Staff (upload → `image_url`) |
| POST | `/businesses/{businessId}/products/{id}/deactivate` | Owner, Staff |

#### Stock

| Method | Path | Role |
|---|---|---|
| GET | `/businesses/{businessId}/stock` | member (on-hand per product) |
| GET | `/businesses/{businessId}/stock/movements` | member (`?product_id=` `?type=`) |
| POST | `/businesses/{businessId}/stock/movements` | Owner, Staff (type `stock_in`\|`adjustment`; signed `quantity_delta`, `reason`) |
| GET | `/businesses/{businessId}/stock/low` | member (on-hand ≤ threshold) |

#### Sales & receipts

| Method | Path | Role |
|---|---|---|
| POST | `/businesses/{businessId}/sales` | Owner, Staff (lines: product_id, quantity, unit_price?, discount?) → 422 `insufficient_stock` if short |
| GET | `/businesses/{businessId}/sales` | Owner (all); Staff (own) |
| GET | `/businesses/{businessId}/sales/{id}` | Owner; Staff (own) |
| POST | `/businesses/{businessId}/sales/{id}/void` | Owner |
| GET | `/r/{public_token}` | public, no auth — receipt view payload |

#### Winger

| Method | Path | Role |
|---|---|---|
| POST | `/businesses/{businessId}/winger-accounts` | Owner (body: user email/phone → resolves/creates user) |
| GET | `/businesses/{businessId}/winger-accounts` | Owner |
| PATCH | `/businesses/{businessId}/winger-accounts/{id}` | Owner (suspend/reactivate) |
| GET | `/winger/businesses` | Winger — businesses the caller is an active winger for |
| GET | `/winger/businesses/{businessId}/products` | Winger — `{ name, image_url, price, currency, in_stock }` only; 403 if not authorized |

`/v1/winger/*` carries a verified user context but no membership scope; the `winger`
service authorizes each call against its own `winger_account` (`active`) rows —
`business_id` in the path with no matching active account → `403 winger_scope_denied`,
and a `suspended` account → `403` on every winger route. `price = winger_price ?? sell_price`;
`in_stock = on_hand > 0` (the number is never exposed). `POST /businesses/{id}/winger-accounts`
with an `email`/`phone` that matches no user provisions a passwordless shell user via
`identity.getUser { create: true }`; a user who already holds a `membership` in that
business → `409 conflict`.

#### Alerts

| Method | Path | Role |
|---|---|---|
| GET | `/businesses/{businessId}/alert-config` | Owner |
| PUT | `/businesses/{businessId}/alert-config` | Owner (recipients, min_interval_hours) |

#### Control-plane (`/v1/admin`, audience `operator`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/businesses` | provision a business + first owner |
| GET | `/admin/businesses` | id, name, subscription_status, counts only |
| PATCH | `/admin/businesses/{id}` | set `subscription_status` |
| POST | `/admin/support-grants` | request break-glass (pending owner approval) |
| GET | `/admin/support-grants` | list own grants |

#### Owner-side support approval

| Method | Path | Role |
|---|---|---|
| GET | `/businesses/{businessId}/support-grants` | Owner |
| POST | `/businesses/{businessId}/support-grants/{id}/approve` | Owner (sets `expires_at` ≤ 24h) |
| POST | `/businesses/{businessId}/support-grants/{id}/revoke` | Owner |

## Decisions

- Path-scoped tenancy, not header-scoped, so tenancy is visible in logs and routing.
- Price fields on product write are silently dropped for Staff, not a 400, to keep the mobile form simple; server is the authority.
- Receipt route lives at `/v1/r/{token}` (short) and is unauthenticated.
- Edge rate limits (Kong `rate-limiting`, `policy: local`, `limit_by: ip`): the public auth routes (`/v1/auth/{register,login,refresh}`, `/v1/auth/operator/login`) at 60/min; the public receipt route (`/v1/r/{token}`) at 120/min. Exceeding either returns `429`.

## Contracts

- OpenAPI document is generated in CI and committed as `openapi.json`; drift fails the build.
- Winger product response schema is a fixed whitelist; a schema test asserts no extra fields.

## Acceptance Criteria

- Every endpoint above has a contract test for the happy path and its documented error codes.
- `GET /winger/.../products` response validated against the whitelist schema.
- `GET /r/{token}` returns 200 without an `Authorization` header and 404 for an unknown/void token.
