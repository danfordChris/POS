# System Overview

## Context

- Microservices. Two clients, one public gateway, a set of domain services, one message broker, one shared PostgreSQL instance with a schema per service.
- See `docs/design/decisions/0002-microservices.md` and `docs/design/architecture/service-decomposition.md`.

## Requirements

### Components

| Component | Tech | Responsibility |
|---|---|---|
| Mobile app | Flutter (Android, iOS) | Floor work: catalog, scan, stock-in, sales, receipts, low-stock |
| Web admin | Next.js | Management: members, catalog, stock history, sales, winger admin, alerts, reports |
| `gateway` | NestJS | Public REST (`/v1/*`, OpenAPI); user-JWT verification; membership resolution + cache; routing; rate limiting; response shaping |
| `identity` | NestJS | Users, operators, credentials, access/refresh tokens |
| `tenancy` | NestJS | Businesses, memberships, invitations |
| `catalog` | NestJS | Categories, products, pricing, image metadata |
| `inventory` | NestJS | Stock items, movements, reorder thresholds, low-stock detection |
| `sales` | NestJS | Sales, sale lines, receipts |
| `winger` | NestJS | Reseller portal API; `winger_account`; catalog/price/in-stock read model |
| `notifications` | NestJS (worker) | Email/SMS dispatch, templates, notification log |
| Broker | NATS + JetStream | Domain events (pub/sub) and synchronous inter-service calls (request/reply) |
| Database | One shared PostgreSQL (+ Prisma) | One schema + non-superuser role per service; each owns its migrations and RLS; no cross-schema grants |
| Object storage | S3-compatible | Product images (`catalog` writes, `gateway`/clients read) |
| Email/SMS | Transactional providers | Used by `notifications` only |
| Cache/queue | Redis per service as needed | Membership cache (gateway), retry queues (notifications) |

### Control-plane vs data-plane

- Data-plane: `/v1/businesses/{businessId}/*` and `/v1/winger/*` at the gateway. Requires a tenant membership.
- Control-plane: `/v1/admin/*` at the gateway. Operator identity. No route reaches data-plane services without a `SupportAccessGrant` (Phase 06).
- User and operator token audiences are not interchangeable; enforced at the gateway.

### Request flow (tenant route)

1. Client → `gateway` with `Authorization: Bearer <user JWT>`.
2. `gateway` verifies the token locally (JWKS/shared secret from `identity`), rejecting operator-audience tokens on data routes (403 `operator_data_access_denied`).
3. `gateway` reads `businessId` from the path and resolves the caller's membership via `tenancy.resolveMembership` (NATS request/reply, short-TTL cache); no membership → 403 `not_a_member`.
4. `gateway` forwards the call to the owning service with signed internal context: `request_id`, `user_id`, `business_id`, `role`.
5. The service validates the internal context, runs inside `runInTenantContext(business_id)` against its own schema (RLS enforced), and returns a DTO. `winger` responses use a whitelisted DTO.
6. `gateway` shapes the response and applies the canonical error envelope.

### Data flow examples

- **Sale** (saga): client → `gateway` → `sales.createSale`. `sales` reserves stock via `inventory.reserveStock` (request/reply); on success writes `sale` + `sale_line` + `receipt`, emits `SaleCompleted`; `inventory` consumes it to finalise `stock_movement(type=sale)`. On failure `sales` calls `inventory.releaseReservation` (compensation).
- **Low-stock**: `inventory` records a movement, computes on-hand, and on the false→true threshold edge emits `StockFellBelowThreshold`. `notifications` consumes it, renders the localized email, sends via the provider, retries on failure, and logs to its `notification` table.
- **Winger catalog**: `catalog` emits `ProductUpserted`/`PriceChanged`; `inventory` emits `StockLevelChanged`; `winger` folds both into a per-business read model that its API serves with no quantities.

### Environments

- `local` (docker-compose: all services + NATS + one Postgres with a schema per service + MinIO + Mailpit), `staging`, `production` (Kubernetes; per-service Deployment + Service + HPA; NATS cluster; one managed Postgres instance; managed object storage).

## Decisions

- One shared PostgreSQL instance, one schema + role per service; no cross-service SQL. See decision 0002.
- NATS + JetStream is the only messaging substrate (events + request/reply).
- Transactional outbox + idempotent consumers; sagas for multi-service writes.
- Only the gateway is publicly reachable; services communicate on the private network and trust the gateway-issued internal context.
- REST + OpenAPI at the edge; no GraphQL.

## Contracts

- Each service is the sole writer of its own schema.
- Event and RPC payloads are versioned schemas in `@pos/contracts` (`docs/design/interfaces/events-catalog.md`, `internal-rpc.md`).
- Clients hold no business rules that the owning service does not also enforce.
- Every inter-service message carries `request_id` and (for data-plane) `business_id`.

## Acceptance Criteria

- `docker-compose up` in `local` brings up every service healthy, with NATS and one Postgres holding a schema per service, and the mobile app + web admin work end to end through the gateway.
- Cross-tenant test: a member of business A gets 403 on every business-B route at the gateway, and each service's RLS returns zero rows when `business_id` is unset.
- Operator token → 403 on every data-plane route at the gateway.
- Killing any single non-gateway service degrades only its capability; the rest keep serving (verified for `notifications` and `winger`).
- A sale that fails at stock reservation creates no `sale`/`sale_line` rows and no stock movement (saga compensation proven).
