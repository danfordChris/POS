# /add-endpoint

Add a public REST route. The `gateway` service is the only externally reachable
API; it forwards to the owning service with a signed internal context.

Full skill: [`.agents/skills/skills/backend/add-endpoint.md`](../skills/backend/add-endpoint.md).

## When

A row in `docs/design/interfaces/api-contract.md`. New behavior → add the row
(design) or `docs/changes/proposed/` first.

## Steps

1. **Owning service** — controller + `class-validator` DTO + role guard; logic in a service class, tenant-scoped via `runInTenantContext`. Role-shaped responses where the contract says so (e.g. Staff product response has no `cost_price`; price fields on write silently dropped for Staff). Emit the documented event via the outbox if state changes. Contribute the OpenAPI fragment.
2. **Gateway** — verify JWT locally, resolve membership (`tenancy.resolveMembership`, cached 30–60s), forward with signed internal context (`request_id`, `user_id`, `business_id`, `role`, `token_kind`); `try/catch` → `503` on transport failure. Never trust client `business_id` beyond the path.
3. Regenerate + commit `services/gateway/openapi.json` (drift fails CI).

## Rules

- `/v1`, JSON, UUID ids, money = minor units + `currency`, ISO 8601 UTC.
- Pagination `?limit=` (≤100) + `?cursor=` → `{ data, next_cursor }`.
- `Idempotency-Key` on `POST /sales` and `POST /stock/movements`.
- Error envelope + codes from `api-contract.md`. Operator token on tenant data → 403 `operator_data_access_denied`.

## Tests (required)

Happy path **and every documented error code** for the row; cross-tenant probe →
403 no leak; winger product route validated against the fixed whitelist schema.
