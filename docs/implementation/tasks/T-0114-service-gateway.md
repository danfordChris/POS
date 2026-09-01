# T-0114 Edge Gateway — Kong

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/system-overview.md`, `docs/design/architecture/service-decomposition.md`, `docs/design/architecture/multi-tenancy.md`, `docs/design/interfaces/api-contract.md`, `docs/design/interfaces/internal-rpc.md`
- Constraints: the only public service; verifies the user JWT locally; never trusts a client-supplied `business_id` beyond the path; try/catch around every downstream call.
- Do not touch: domain-service business logic.

## Objective

**Kong** (DB-less) is the single public entry for `/v1/*`: routing, rate limiting, CORS, correlation id, and — via the custom `pos-internal-context` Lua plugin — JWT verification, the operator/audience gate, membership resolution, and signing the internal context forwarded to services. (The NestJS `gateway` service from decision 0002 is dropped.)

## Scope Boundary

**In scope (as built):**
- `infra/kong/kong.yml` — DB-less declarative: `identity` + `tenancy` upstreams; routes `auth-public` (register/login/refresh/operator-login, rate-limited, no plugin), `auth-private` (logout/me/operator-me, plugin, no business scope), `businesses` (`/v1/businesses`, plugin, `require_business_scope: true`). Global `cors`, `request-size-limiting`, `correlation-id`. Secrets via `{vault://env/...}` (Kong `env` vault).
- `infra/kong/plugins/pos-internal-context/{handler.lua,schema.lua}` — Kong-bundled libs only (`kong.plugins.jwt.jwt_parser`, `resty.openssl.hmac`, `resty.http`). Verifies HS256 signature + `exp`; on `businesses` routes rejects `aud=operator` (403 `operator_data_access_denied`) and resolves membership via a `membership_cache_ttl`-cached call to `tenancy`'s internal endpoint (403 `not_a_member` on miss); signs `{request_id,user_id,business_id,role,token_kind,issued_at,expires_at}` (HMAC-SHA256, base64url) → `X-Pos-Internal-Context` + `X-Pos-Internal-Signature`. Failures use the canonical `{error:{code,message,devMessage,details},requestId}` envelope.
- `services/tenancy`: `GET /v1/internal/membership` guarded by `X-Internal-Api-Key` (the plugin's membership lookup).
- `infra/docker-compose.yml`: `kong` service (+ `identity`/`tenancy` build entries). `infra/k8s/base/kong.yaml` + `kong-config.yaml` replace `gateway.yaml`; NetworkPolicy + Ingress updated to Kong.

**Out of scope / deferred:**
- Aggregated `/v1/docs` — each service serves its own; a merged edge doc is a follow-up.
- Active membership-cache bust on `MembershipSuspended` — the plugin relies on the short `membership_cache_ttl` (30s); an event-driven Kong cache flush is a Phase 06 item.
- gRPC / response aggregation.

## Acceptance Criteria

- [x] `kong config parse` succeeds with the plugin loaded; `kubectl kustomize infra/k8s/base` renders (22 kinds).
- [x] Live e2e through Kong (`:8000`, real `identity`+`tenancy`): register 201 → login → `GET /v1/auth/me` 200 → `POST /v1/businesses` 201 → `GET /v1/businesses/:id` 200 for the owner, **403 `not_a_member`** for a stranger.
- [x] No bearer token → 401 `unauthenticated`; bad signature → 401; all bodies carry `message` + `devMessage` + `details` + `requestId`.
- [x] Operator gate + membership lookup exercised via the plugin against `tenancy`'s `X-Internal-Api-Key`-guarded `/v1/internal/membership`.

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

- `docker run kong:3.7 kong config parse` with the plugin mounted → `parse successful`.
- Live: host `identity`:3001 + `tenancy`:3002 + `kong` container → the full register→login→me→create-business→read-business flow returns the expected codes and envelopes; stranger read → 403 `not_a_member`.
- `kubectl kustomize infra/k8s/base` → exit 0.
- `services/tenancy` 9 e2e tests cover the internal endpoint + `resolveMembership` RPC + the internal-context guard directly.
