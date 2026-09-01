# Decision 0002 — Microservices Architecture

## Date

2026-09-01

## Decision

- The platform is built as **microservices from day one** (supersedes the modular-monolith assumption in decision 0001 and the original `system-overview.md`).
- Services (bounded contexts), each its own deployable, each owning a schema in the shared PostgreSQL:
  - **Kong** (edge gateway, DB-less/declarative) — TLS, path routing, rate limiting, CORS, JWT signature/exp. A custom Lua plugin `pos-internal-context` adds the audience gate, membership lookup, and signs the internal context. Only public entry point. (Revised 2026-09-02 from a NestJS `gateway` service.)
  - `identity` — users, operators, credentials, access/refresh tokens. Owns `user`, `operator`, `refresh_token`.
  - `tenancy` — businesses, memberships, invitations. Owns `business`, `membership`, `invitation`.
  - `catalog` — categories, products, pricing (incl. winger price), image metadata. Owns `category`, `product`.
  - `inventory` — stock items, movements, reorder thresholds, low-stock detection. Owns `stock_item`, `stock_movement`, `alert_config`, `low_stock_alert_state`.
  - `sales` — sales, sale lines, receipts. Owns `sale`, `sale_line`, `receipt`.
  - `winger` — reseller portal API + `winger_account`; a read model projected from `catalog` + `inventory` events.
  - `notifications` — email/SMS workers, templates, `notification` log. No inbound public API.
- **Transport**: NATS + JetStream. Domain events are pub/sub on JetStream streams; synchronous inter-service calls use NATS request/reply. gRPC is reserved for a specific hot path only if request/reply proves insufficient.
- **Data**: **one shared PostgreSQL instance** for all services. Each service owns a dedicated **schema** and connects as a **non-superuser role granted only on its own schema** — no service can read another service's tables. Each service runs its own Prisma schema + migrations against its schema. (Revised 2026-09-02 from database-per-service; independent scaling is still served via schema + role isolation and stateless service pods, and a hot schema can be split to its own instance later without app changes.)
- **Error envelope**: every response body on failure is `{ error: { code, message, devMessage, details }, requestId }` — `message` is user-friendly, `devMessage` is the technical detail (no stack, no secrets).
- **Consistency**: transactional outbox per service + idempotent consumers. Multi-service writes (e.g. sale → stock decrement) use a saga with compensation.
- **Tenant isolation**: the gateway resolves `business_id` from the path + the caller's membership and propagates it as signed internal context. Each tenant-owning service enforces `business_id` scoping in its own schema and keeps the `runInTenantContext` + `enable_tenant_rls()` pattern.
- **Auth trust boundary**: only the edge (Kong + `pos-internal-context`) verifies the user access token. Downstream services trust the signed internal context on the private network and validate its HMAC + shape + expiry; they do not re-verify the user JWT. Operator tokens are rejected at the edge on all data-plane routes.
- **Orchestration**: Kubernetes in production. Local dev uses `docker-compose` (all services + NATS + one Postgres with a schema per service + MinIO + Mailpit).
- **Repo**: single pnpm monorepo — `services/<name>/`, `packages/<name>/` (`@pos/contracts`, `@pos/nest-common`, `@pos/testing`), `web/`, `mobile/`, `infra/`.
- **Observability**: OpenTelemetry traces (context propagated across NATS), structured logs with `request_id` + `business_id`, per-service `/healthz` + `/readyz`.

## Reason

- Explicit product owner requirement: independent scaling of services.
- Bounded contexts are already clear from `docs/design/product/*`; splitting now avoids a later untangling.
- NATS gives one substrate for both events and RPC, is light to run, and fits Kubernetes.
- A shared Postgres with schema + role isolation keeps operations simple for the MVP (one instance to run, back up, and monitor) while still forbidding cross-service table access; the no-cross-service-joins rule and sagas are kept regardless.

## Impacted Docs

- `docs/design/architecture/system-overview.md` (rewritten)
- `docs/design/architecture/service-decomposition.md` (new)
- `docs/design/architecture/multi-tenancy.md` (updated)
- `docs/design/interfaces/events-catalog.md`, `docs/design/interfaces/internal-rpc.md` (new)
- `docs/design/interfaces/api-contract.md` (now the gateway's public contract)
- `docs/design/integrations/README.md` (NATS added)
- `docs/implementation/project.md`, `phases/*` (Phase 01 — Platform inserted; features renumbered 02–06)

## Confirmed defaults (2026-09-01)

- Broker: **NATS + JetStream** (events + request/reply).
- Sync inter-service transport: **NATS request/reply** (no separate gRPC stack).
- Data topology: **one shared PostgreSQL instance**, one schema + one non-superuser role per service (revised 2026-09-02).
- Production orchestration: **Kubernetes**.
- Auth trust boundary: **only the edge verifies the user JWT**; downstream services trust a signed internal context.
- Edge gateway: **Kong** (DB-less local via docker-compose; Helm chart in production) with a custom `pos-internal-context` Lua plugin (revised 2026-09-02).

## Open (non-blocking)

- Service mesh (mTLS via Linkerd/Istio) vs. plain Kubernetes NetworkPolicies — decide in Phase 06.
