# T-0114 services/gateway

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/system-overview.md`, `docs/design/architecture/service-decomposition.md`, `docs/design/architecture/multi-tenancy.md`, `docs/design/interfaces/api-contract.md`, `docs/design/interfaces/internal-rpc.md`
- Constraints: the only public service; verifies the user JWT locally; never trusts a client-supplied `business_id` beyond the path; try/catch around every downstream call.
- Do not touch: domain-service business logic.

## Objective

`services/gateway` terminates all `/v1/*` traffic: verifies the access token, rejects operator tokens on data routes, resolves membership, forwards to the owning service with a signed internal context, and shapes responses + errors.

## Scope Boundary

**In scope:**
- New NestJS service; HTTP server on `:3000`; global prefix `v1`; `@pos/nest-common` error envelope + correlation id + not-found fallback.
- Token verification using the shared access secret / JWKS from `identity`; audience check (`user` vs `operator`).
- Membership resolution via `pos.rpc.tenancy.resolveMembership` with a Redis cache (TTL 30–60s); cache bust on `MembershipSuspended` / `WingerSuspended` events.
- Internal-context signer (`@pos/nest-common`): attach `{ request_id, user_id, business_id, role, token_kind }` to every downstream request.
- Routing table: `/v1/auth/*` → identity; `/v1/businesses/*` → tenancy; other prefixes wired as their services land (feature phases).
- OpenAPI composition: fetch each service's contribution, merge, serve at `/v1/docs` + `/v1/docs-json`; drift check.
- Rate limiting on `/v1/auth/*`.
- `/healthz`, `/readyz` (NATS + Redis), Dockerfile, k8s overlay, ingress.

**Out of scope:**
- Response aggregation across multiple services in one call (not needed at MVP).
- Feature routes whose services do not exist yet.

## Acceptance Criteria

- [ ] `GET /v1/health` (or `/healthz`) 200; `/readyz` 503 when NATS/Redis down.
- [ ] A valid `user` token on `/v1/businesses/:id` is forwarded with a signed internal context; `tenancy` accepts it.
- [ ] An `operator` token on `/v1/businesses/:id` → 403 `operator_data_access_denied` at the gateway (no downstream call).
- [ ] A member of business A on business B → 403 `not_a_member` (membership resolve miss).
- [ ] `MembershipSuspended` for a cached `(business,user)` busts the cache within one event round-trip.
- [ ] `/v1/docs-json` merges identity + tenancy contributions; `openapi:check` passes.
- [ ] Unknown route → JSON error envelope, not HTML.

## Dependencies

- T-0110, T-0111, T-0112, T-0113, T-0115

## Implementation Checklist

- [ ] Scaffold `services/gateway`; wire `@pos/nest-common`.
- [ ] Implement token verify + audience guard; internal-context signer.
- [ ] Implement membership resolver + Redis cache + event-driven bust.
- [ ] Implement the routing/proxy layer to identity + tenancy.
- [ ] Implement OpenAPI composition + drift check.
- [ ] Health, rate limiting, Dockerfile, k8s overlay, ingress.

## Verification

- Command: `pnpm --filter @pos/gateway test`
- Evidence: e2e run of an auth flow and a business flow through the gateway, plus the operator-403 and cache-bust cases, pasted into the PR.
