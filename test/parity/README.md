# Phase 00 → microservices parity

`api/` (the Phase 00 monolith) is retired. Every endpoint it served is now served
by a service and covered by that service's e2e suite, and the full cross-service
flow is exercised live through Kong.

## Endpoint coverage map

| Phase 00 endpoint | Now served by | Covered by |
|---|---|---|
| `POST /v1/auth/register` (201 / 409 / 400) | identity | `services/identity/test/identity.e2e-spec.ts` — "register 201 + duplicate 409 + missing-contact 400" |
| `POST /v1/auth/login` (200 / 401) | identity | same — "login + me + refresh rotation/reuse + logout" |
| `GET /v1/auth/me` (200 / 401) | identity | same |
| `POST /v1/auth/refresh` (rotation + reuse → 401) | identity | same |
| `POST /v1/auth/logout` (204) | identity | same |
| `POST /v1/auth/operator/login`, `GET /v1/auth/operator/me` | identity | same — "token audiences stay separate" |
| audience rejection (`wrong_token_audience`) | identity | same |
| `/auth/*` rate limit (429 `rate_limited`) | identity | same — "rate-limits repeated failed logins" |
| `POST /v1/businesses` (201, owner membership) | tenancy | `services/tenancy/test/tenancy.e2e-spec.ts` — "creates the business + owner membership …" |
| `GET /v1/businesses/:id` (200 member / 403 non-member) | tenancy | same — "owner reads and updates; … stranger 403 not_a_member" |
| `PATCH /v1/businesses/:id` (owner 200 / staff 403 `role_forbidden`) | tenancy | same |
| operator → 403 `operator_data_access_denied` | Kong plugin + tenancy `TenantGuard` | same — "an operator-kind context is refused …" + live Kong smoke |
| RLS backstop (0 rows / rejected write with no `app.business_id`) | tenancy | same — "RLS backstop" |
| validation + not-found envelope (`{error:{code,message,devMessage,details},requestId}`) | `@pos/nest-common` | `packages/nest-common/src/http/all-exceptions.filter.spec.ts` |

## Live end-to-end (through Kong)

Verified against the real `identity` + `tenancy` + `kong` (`:8000`):

```
POST /v1/auth/register        -> 201
POST /v1/auth/login           -> 200 { accessToken, refreshToken, ... }
GET  /v1/auth/me              -> 200 (Kong plugin verified the JWT, signed the context)
POST /v1/businesses           -> 201 (owner membership created; BusinessCreated + MembershipCreated emitted)
GET  /v1/businesses/:id       -> 200 for the owner
GET  /v1/businesses/:id       -> 403 not_a_member for a stranger
GET  /v1/auth/me (no token)   -> 401 unauthenticated  { message, devMessage, details, requestId }
```
