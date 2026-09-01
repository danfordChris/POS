# Decision 0002 — Microservices Architecture

## Date

2026-09-01

## Decision

- The platform is built as **microservices from day one** (supersedes the modular-monolith assumption in decision 0001 and the original `system-overview.md`).
- Services (bounded contexts), each its own deployable + database:
  - `gateway` — public edge / BFF: TLS (behind ingress), user-JWT verification, membership resolution + cache, routing, rate limiting, response shaping. Only public entry point.
  - `identity` — users, operators, credentials, access/refresh tokens. Owns `user`, `operator`, `refresh_token`.
  - `tenancy` — businesses, memberships, invitations. Owns `business`, `membership`, `invitation`.
  - `catalog` — categories, products, pricing (incl. winger price), image metadata. Owns `category`, `product`.
  - `inventory` — stock items, movements, reorder thresholds, low-stock detection. Owns `stock_item`, `stock_movement`, `alert_config`, `low_stock_alert_state`.
  - `sales` — sales, sale lines, receipts. Owns `sale`, `sale_line`, `receipt`.
  - `winger` — reseller portal API + `winger_account`; a read model projected from `catalog` + `inventory` events.
  - `notifications` — email/SMS workers, templates, `notification` log. No inbound public API.
- **Transport**: NATS + JetStream. Domain events are pub/sub on JetStream streams; synchronous inter-service calls use NATS request/reply. gRPC is reserved for a specific hot path only if request/reply proves insufficient.
- **Data**: database-per-service. No service reads another service's tables. One PostgreSQL cluster in local dev (one database per service); separate instances in production.
- **Consistency**: transactional outbox per service + idempotent consumers. Multi-service writes (e.g. sale → stock decrement) use a saga with compensation.
- **Tenant isolation**: the gateway resolves `business_id` from the path + the caller's membership and propagates it as signed internal context. Each tenant-owning service enforces `business_id` scoping in its own DB and keeps the `runInTenantContext` + `enable_tenant_rls()` pattern.
- **Auth trust boundary**: only the gateway verifies the user access token. Downstream services trust the gateway-supplied internal context on the private network and validate its signature/shape; they do not re-verify the user JWT. Operator tokens are rejected by the gateway on all data-plane routes.
- **Orchestration**: Kubernetes in production. Local dev uses `docker-compose` (all services + NATS + per-service Postgres + MinIO + Mailpit).
- **Repo**: single pnpm monorepo — `services/<name>/`, `packages/<name>/` (`@pos/contracts`, `@pos/nest-common`, `@pos/testing`), `web/`, `mobile/`, `infra/`.
- **Observability**: OpenTelemetry traces (context propagated across NATS), structured logs with `request_id` + `business_id`, per-service `/healthz` + `/readyz`.

## Reason

- Explicit product owner requirement: independent scaling of services.
- Bounded contexts are already clear from `docs/design/product/*`; splitting now avoids a later untangling.
- NATS gives one substrate for both events and RPC, is light to run, and fits Kubernetes.
- Database-per-service is what makes independent scaling and deployment real; the cost (no cross-service joins, sagas) is accepted.

## Impacted Docs

- `docs/design/architecture/system-overview.md` (rewritten)
- `docs/design/architecture/service-decomposition.md` (new)
- `docs/design/architecture/multi-tenancy.md` (updated)
- `docs/design/interfaces/events-catalog.md`, `docs/design/interfaces/internal-rpc.md` (new)
- `docs/design/interfaces/api-contract.md` (now the gateway's public contract)
- `docs/design/integrations/README.md` (NATS added)
- `docs/implementation/project.md`, `phases/*` (Phase 01 — Platform inserted; features renumbered 02–06)

## Open (non-blocking)

- Broker, sync-transport, DB topology, and orchestration defaults are listed in `docs/changes/proposed/0002-service-architecture.md` for override before Phase 01.
- Service mesh (mTLS via Linkerd/Istio) vs. plain Kubernetes NetworkPolicies — decide during Phase 01.
