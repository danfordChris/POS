# Service Decomposition

## Context

- Realises decision 0002. Defines each service's ownership, dependencies, transport, and data.
- One pnpm monorepo: `services/<name>/`, `packages/<name>/`, `web/`, `mobile/`, `infra/`.

## Requirements

### Context map

| Service | Owns (tables) | Public API (via gateway) | Emits (events) | Consumes | Sync deps (request/reply) |
|---|---|---|---|---|---|
| `gateway` | — | all `/v1/*` | — | — | `identity.verifyToken` (fallback), `tenancy.resolveMembership` |
| `identity` | `user`, `operator`, `refresh_token` | `/v1/auth/*` | `UserRegistered` | — | — |
| `tenancy` | `business`, `membership`, `invitation` | `/v1/businesses/*`, `/v1/invitations/*` | `BusinessCreated`, `MembershipCreated`, `MembershipSuspended`, `InvitationCreated`, `InvitationAccepted` | `UserRegistered` (optional link) | `identity.getUser` |
| `catalog` | `category`, `product` | `/v1/businesses/{id}/categories`, `/v1/businesses/{id}/products` | `ProductUpserted`, `ProductDeactivated`, `PriceChanged`, `CategoryUpserted` | `BusinessCreated` | — |
| `inventory` | `stock_item`, `stock_movement`, `alert_config`, `low_stock_alert_state` | `/v1/businesses/{id}/stock/*`, `/v1/businesses/{id}/alert-config` | `StockLevelChanged`, `StockMovementRecorded`, `StockFellBelowThreshold`, `StockRecovered` | `ProductUpserted` (seed `stock_item`), `ProductDeactivated` | serves `reserveStock`, `commitReservation`, `releaseReservation` |
| `sales` | `sale`, `sale_line`, `receipt` | `/v1/businesses/{id}/sales/*`, `/v1/r/{token}` | `SaleCompleted`, `SaleVoided` | `PriceChanged` (cache price), `ProductUpserted` (name cache) | `inventory.reserveStock` / `commitReservation` / `releaseReservation` |
| `winger` | `winger_account`, `winger_catalog_projection` | `/v1/businesses/{id}/winger-accounts`, `/v1/winger/*` | `WingerAuthorized`, `WingerSuspended` | `ProductUpserted`, `PriceChanged`, `ProductDeactivated`, `StockLevelChanged` | `identity.getUser` (resolve winger by email/phone) |
| `notifications` | `notification` | — | `NotificationSent`, `NotificationFailed` | `InvitationCreated`, `WingerAuthorized`, `StockFellBelowThreshold` | — |

### Transport rules

- **Async first**: cross-context state changes propagate as JetStream events. Consumers are idempotent (dedupe on `event_id`).
- **Request/reply** only when a caller needs data it cannot own a copy of, and staleness is unacceptable:
  - `gateway → tenancy.resolveMembership` (per data-plane request; cached 30–60s).
  - `sales → inventory.reserve/commit/release` (saga steps).
  - `tenancy/winger → identity.getUser` (resolve/create a user by email/phone).
- **No** service calls another service's database. **No** shared ORM models across services.
- Subjects: `pos.evt.<context>.<Event>` (events), `pos.rpc.<context>.<Method>` (request/reply). Constants in `@pos/contracts`.

### Data ownership

- Database-per-service: `identity_db`, `tenancy_db`, `catalog_db`, `inventory_db`, `sales_db`, `winger_db`, `notifications_db`.
- Each service runs its own Prisma schema + migrations + `enable_tenant_rls()` on its tenant tables.
- Denormalized copies are allowed and expected (e.g. `sales` caches product name + price; `winger` builds a projection). The copy's owner is the emitting service; the holder treats it as read-only cache rebuilt from events.
- Reference-by-id only across services (`business_id`, `user_id`, `product_id`); no cross-DB foreign keys.

### Consistency

- **Transactional outbox** per service: domain write + outbox row in one local transaction; a relay publishes to JetStream and marks sent.
- **Idempotent consumers**: each handler records `event_id` in a `processed_events` table; duplicate delivery is a no-op.
- **Sagas** for multi-service writes. Sale saga: `reserveStock` → write `sale`/`sale_line`/`receipt` + emit `SaleCompleted` → `inventory` commits reservation on the event. Failure at any step → `releaseReservation`, no sale rows.

### Tenant isolation across services

- The gateway is the only component that verifies the user token and resolves membership.
- It forwards a **signed internal context** (HMAC or short-lived internal JWT) on every downstream call: `request_id`, `user_id`, `business_id`, `role`, `token_kind`.
- Downstream services: reject a missing/invalid internal context (500-class, logged), then run `runInTenantContext(business_id)` so their DB's RLS scopes every statement.
- `identity` holds no tenant tables and takes no `business_id`.

### Shared packages

| Package | Contents |
|---|---|
| `@pos/contracts` | Event + RPC payload schemas (zod), subject constants, error codes, internal-context shape |
| `@pos/nest-common` | Error-envelope filter, correlation-id middleware, zod env config, NATS client bootstrap, outbox + idempotency helpers, `runInTenantContext` base, health controller, OpenTelemetry setup |
| `@pos/testing` | In-memory NATS test double, service test harness, fixture builders |

### Deployment

- **Local**: `infra/docker-compose.yml` — NATS (JetStream), one Postgres (a database per service), MinIO, Mailpit, and each service. Gateway on `:3000`.
- **Production**: Kubernetes. Per service: `Deployment`, `Service` (ClusterIP), `HorizontalPodAutoscaler`, `PodDisruptionBudget`; config via `ConfigMap`/`Secret`; NATS as a StatefulSet cluster (Helm); managed Postgres per service; ingress → gateway only; `NetworkPolicy` denying ingress to non-gateway services from outside the namespace.
- Each service: multi-stage Dockerfile, `/healthz` (liveness) + `/readyz` (readiness incl. DB + NATS), graceful shutdown draining NATS subscriptions.

### Relocation of existing code (T-0001..T-0004 output)

| Built in | Moves to |
|---|---|
| `api/` NestJS app shell, error envelope, correlation id, config, health | `packages/nest-common` + `services/gateway` skeleton |
| `api/src/auth/*` (password, token, guards, refresh tokens) | `services/identity` (+ token-verify helper in `@pos/nest-common` for the gateway) |
| `api/src/businesses/*`, `api/src/tenancy/*` | `services/tenancy` |
| `api/prisma` (`user`, `operator`, `refresh_token`) | `services/identity/prisma` |
| `api/prisma` (`business`, `membership`, `enable_tenant_rls`) | `services/tenancy/prisma`; helper also copied into `@pos/nest-common` migration snippets |
| `api/` OpenAPI scripts | `services/gateway` (composes downstream contributions) |

## Decisions

- Eight services at MVP (`gateway` + 7 domain). No further splitting until load data says otherwise.
- `reporting` and `media` are future services, not MVP.
- No service mesh in MVP; Kubernetes `NetworkPolicy` + internal-context signing. Mesh (mTLS) revisited in Phase 06.

## Contracts

- A service may be deployed, scaled, and released independently of the others.
- Breaking an event/RPC schema requires a new version subject and a deprecation window; `@pos/contracts` is the single source.
- The gateway's OpenAPI is the only external contract; internal subjects are not public.

## Acceptance Criteria

- Each service builds, tests, and containerises on its own; CI runs per-service jobs plus a contracts compatibility check.
- A consumer receiving the same event twice produces one state change (idempotency test per consumer).
- Removing `notifications` or `winger` from `local` leaves all other endpoints working.
- No service's Prisma schema references another service's tables (static check).
- The sale saga leaves no partial writes on stock-reservation failure.
