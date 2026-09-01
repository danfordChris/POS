# Add a Gateway REST Endpoint

The `gateway` service is the **only** externally reachable API. Add a route
there, forward to the owning service with a signed internal context, and handle
it in that service.

## Arguments

`$ARGUMENTS` — method + path + owner + role, e.g.
`POST /v1/businesses/{businessId}/products, owner catalog, roles Owner+Staff, price fields Owner-only`

Must be a row in `docs/design/interfaces/api-contract.md`. New behavior → add the
row there (design) or `docs/changes/proposed/` first. The gateway's generated
`openapi.json` is the only external contract; drift fails CI.

## Rules

- Base path `/v1`, JSON only. IDs are UUID. Money = integer minor units + `currency`. Timestamps ISO 8601 UTC.
- Tenant routes are path-scoped `/v1/businesses/{businessId}/...`. The gateway verifies the JWT locally (shared key; `identity.verifyToken` fallback), resolves membership via `tenancy.resolveMembership` (cached 30–60s), then forwards.
- Two audiences: `user`, `operator`. Wrong audience → 401 `wrong_token_audience`. Operator token on a tenant data route → 403 `operator_data_access_denied`.
- Pagination: `?limit=` (default 25, max 100) + `?cursor=`; response `{ data: [...], next_cursor }`.
- `POST /sales` and `POST /stock/movements` accept `Idempotency-Key`.
- Error body: `{ error: { code, message, details: [{ field, issue }] } }`. Use the codes table in `api-contract.md` (`validation_error`, `not_a_member`, `role_forbidden`, `not_found`, `conflict`, `insufficient_stock`, ...).
- Never trust a client-supplied `business_id` beyond the path; the forwarded context is authoritative downstream.

## Steps

### 1. Downstream: owning service

- Controller + route under the service, DTO with `class-validator`, role guard (`@Roles(...)` / membership from the internal context).
- Business logic in a service class; tenant-scoped via `runInTenantContext`.
- Role-shaped responses where the contract says so (e.g. Staff product response has **no** `cost_price`; price fields on write are silently dropped for Staff, not a 400).
- If a state change results, emit the documented event via the outbox ([add-event](add-event.md)).
- Contribute this route's OpenAPI fragment (the gateway composes downstream contributions).

### 2. Gateway: route + forward

- Add the route to the gateway; attach the signed internal context (`request_id`, `user_id`, `business_id`, `role`, `token_kind`) — HMAC or 60s internal JWT.
- `try/catch` around the downstream call; map transport failure → `503`, downstream error envelope passed through.
- No response aggregation across services at MVP — one route, one owner.

### 3. Contract tests (required)

In the owning service and/or gateway:

- Happy path → documented success status + body shape.
- **Every** documented error code for the row (`validation_error`, role/membership 403s, `404` echoing the looked-up key, `409`, `422 insufficient_stock`, `410 invitation_expired`, ...).
- Cross-tenant probe → 403, no row leak.
- Winger product route → response validated against the fixed whitelist schema (no extra fields).
- `GET /r/{token}` (if touched) → 200 with no `Authorization` header; unknown/void token → 404.

### 4. OpenAPI

```bash
pnpm --filter @pos/gateway build && pnpm --filter @pos/gateway openapi   # regenerate committed openapi.json
```

## Verification

```bash
pnpm --filter @pos/<owner> test
pnpm --filter @pos/gateway test
git diff --exit-code services/gateway/openapi.json   # must be committed, no drift
python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py
```

## Checklist

- [ ] Row exists in `api-contract.md` (method, path, role)
- [ ] Downstream controller + `class-validator` DTO + role guard; logic tenant-scoped
- [ ] Role-shaped response/write rules honored (e.g. Staff hides cost)
- [ ] Resulting state change emits its event via the outbox
- [ ] Gateway route forwards a signed internal context; `try/catch` → `503` on transport failure
- [ ] Client `business_id` never trusted beyond the path
- [ ] Contract tests: happy path + every documented error code + cross-tenant 403
- [ ] `openapi.json` regenerated and committed
