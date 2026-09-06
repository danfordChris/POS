# Service Decomposition

## Context

- Realises decision 0002. Defines each service's ownership, dependencies, transport, and data.
- One pnpm monorepo: `services/<name>/`, `packages/<name>/`, `web/`, `mobile/`, `infra/`.

## Requirements

### Context map

| Service | Owns (tables) | Public API (via gateway) | Emits (events) | Consumes | Sync deps (request/reply) |
|---|---|---|---|---|---|
| **Kong** (edge) | — | all `/v1/*` | — | — | `tenancy` internal membership HTTP (`pos-internal-context` plugin) |
| `identity` | `user`, `operator`, `refresh_token` | `/v1/auth/*` | `UserRegistered` | — | — |
| `tenancy` | `business`, `membership`, `invitation` | `/v1/businesses/*`, `/v1/invitations/*`; internal `GET /internal/membership` (Kong only, shared-secret) | `BusinessCreated`, `MembershipCreated`, `MembershipSuspended`, `InvitationCreated`, `InvitationAccepted` | `UserRegistered` (optional link) | `identity.getUser` |
| `catalog` | `category`, `product` | `/v1/businesses/{id}/categories`, `/v1/businesses/{id}/products` | `ProductUpserted`, `ProductDeactivated`, `PriceChanged`, `CategoryUpserted` | `BusinessCreated` | — |
| `inventory` | `stock_item`, `stock_movement`, `alert_config`, `low_stock_alert_state` | `/v1/businesses/{id}/stock/*`, `/v1/businesses/{id}/alert-config` | `StockLevelChanged`, `StockMovementRecorded`, `StockFellBelowThreshold`, `StockRecovered`, `AlertConfigChanged` | `ProductUpserted` (seed `stock_item`), `ProductDeactivated` | serves `reserveStock`, `commitReservation`, `releaseReservation` |
| `sales` | `sale`, `sale_line`, `receipt` | `/v1/businesses/{id}/sales/*`, `/v1/r/{token}` | `SaleCompleted`, `SaleVoided` | `PriceChanged` (cache price), `ProductUpserted` (name cache) | `inventory.reserveStock` / `commitReservation` / `releaseReservation` |
| `winger` | `winger_account`, `winger_catalog_projection` | `/v1/businesses/{id}/winger-accounts`, `/v1/winger/*` | `WingerAuthorized`, `WingerSuspended` | `ProductUpserted`, `PriceChanged`, `ProductDeactivated`, `StockLevelChanged` | `identity.getUser` (resolve winger by email/phone) |
| `notifications` | `notification`, `notification_contact`, `digest_config` | — | `NotificationSent`, `NotificationFailed` | `InvitationCreated`, `WingerAuthorized`, `StockFellBelowThreshold`, `StockRecovered`, `AlertConfigChanged`, `BusinessCreated`, `MembershipCreated`, `MembershipSuspended` | — |

### Transport rules

- **Async first**: cross-context state changes propagate as JetStream events. Consumers are idempotent (dedupe on `event_id`).
- **Request/reply** only when a caller needs data it cannot own a copy of, and staleness is unacceptable:
  - Kong `pos-internal-context` → `tenancy` internal membership HTTP (per data-plane request; cached 30–60s in the plugin). `tenancy` also exposes `pos.rpc.tenancy.resolveMembership` for service-to-service use.
  - `sales → inventory.reserve/commit/release` (saga steps).
  - `tenancy/winger → identity.getUser` (resolve/create a user by email/phone).
- **No** service calls another service's database. **No** shared ORM models across services.
- Subjects: `pos.evt.<context>.<Event>` (events), `pos.rpc.<context>.<Method>` (request/reply). Constants in `@pos/contracts`.

### Data ownership

- **One shared PostgreSQL instance**, one schema per service: `identity`, `tenancy`, `catalog`, `inventory`, `sales`, `winger`, `notifications`.
- Each service connects as a non-superuser role (`<svc>_app`) that is granted usage/DDL **only on its own schema** and has `search_path` pinned to it. No `GRANT` across schemas → a service physically cannot read another's tables.
- Each service runs its own Prisma schema + migrations against its schema, and calls `enable_tenant_rls()` on its tenant tables.
- Denormalized copies are allowed and expected (e.g. `sales` caches product name + price; `winger` builds a projection). The copy's owner is the emitting service; the holder treats it as a read-only cache rebuilt from events.
- Reference-by-id only across services (`business_id`, `user_id`, `product_id`); no cross-schema foreign keys.
- A schema under load can be moved to its own PostgreSQL instance later by changing only that service's connection string.

### Consistency

- **Transactional outbox** per service: domain write + outbox row in one local transaction; a relay publishes to JetStream and marks sent.
- **Idempotent consumers**: each handler records `event_id` in a `processed_events` table; duplicate delivery is a no-op.
- **Sagas** for multi-service writes. Sale saga: `reserveStock` → write `sale`/`sale_line`/`receipt` + emit `SaleCompleted` → `inventory` commits reservation on the event. Failure at any step → `releaseReservation`, no sale rows.

### Tenant isolation across services

- Kong (`jwt` plugin + `pos-internal-context`) is the only component that verifies the user token and resolves membership.
- The plugin forwards a **signed internal context** (HMAC-SHA256, ≤60s TTL) on every downstream call via `X-Pos-Internal-Context` + `X-Pos-Internal-Signature`: `request_id`, `user_id`, `business_id`, `role`, `token_kind`.
- Downstream services: reject a missing/invalid internal context (500-class, logged), then run `runInTenantContext(business_id)` so their DB's RLS scopes every statement.
- `identity` holds no tenant tables and takes no `business_id`.

### Shared packages

| Package | Contents |
|---|---|
| `@pos/contracts` | Event + RPC payload schemas (zod), subject constants, error codes, internal-context shape |
| `@pos/nest-common` | Error-envelope filter, correlation-id middleware, zod env config, NATS client bootstrap, outbox + idempotency helpers, `runInTenantContext` base, health controller, OpenTelemetry setup |
| `@pos/testing` | In-memory NATS test double, service test harness, fixture builders |

### Deployment

- **Local**: `infra/docker-compose.yml` — Kong (DB-less, `:8000` proxy) + NATS (JetStream) + one Postgres (schema + role per service) + MinIO + Mailpit + each service.
- **Production**: Kubernetes. Kong via the official Helm chart (DB-less, declarative `kong.yml` + the `pos-internal-context` plugin mounted). Per service: `Deployment`, `Service` (ClusterIP), `HorizontalPodAutoscaler`, `PodDisruptionBudget`; config via `ConfigMap`/`Secret`; NATS as a StatefulSet cluster (Helm); one managed Postgres instance (schema + role per service); ingress → Kong only; `NetworkPolicy` denying ingress to non-Kong-reachable services from outside the namespace.
- Each service: multi-stage Dockerfile, `/healthz` (liveness) + `/readyz` (readiness incl. DB + NATS), graceful shutdown draining NATS subscriptions.

### Relocation of existing code (T-0001..T-0004 output)

| Built in | Moves to |
|---|---|
| `api/` NestJS app shell, error envelope, correlation id, config, health | `packages/nest-common` (all services) |
| `api/src/auth/*` (password, token, guards, refresh tokens) | `services/identity` (+ token-verify helper in `@pos/nest-common` for the gateway) |
| `api/src/businesses/*`, `api/src/tenancy/*` | `services/tenancy` |
| `api/prisma` (`user`, `operator`, `refresh_token`) | `services/identity/prisma` |
| `api/prisma` (`business`, `membership`, `enable_tenant_rls`) | `services/tenancy/prisma`; helper also copied into `@pos/nest-common` migration snippets |
| `api/` OpenAPI scripts | each service serves its own `/v1/docs`; a merged edge doc is a follow-up |

## Decisions

- Kong at the edge + 7 domain services at MVP. No further splitting until load data says otherwise.
- `reporting` and `media` are future services, not MVP.
- No service mesh in MVP; Kubernetes `NetworkPolicy` + internal-context signing. Mesh (mTLS) revisited in Phase 06.

## Contracts

- A service may be deployed, scaled, and released independently of the others.
- Breaking an event/RPC schema requires a new version subject and a deprecation window; `@pos/contracts` is the single source.
- The edge (Kong) surface is the only external contract; internal subjects are not public.

## Acceptance Criteria

- Each service builds, tests, and containerises on its own; CI runs per-service jobs plus a contracts compatibility check.
- A consumer receiving the same event twice produces one state change (idempotency test per consumer).
- Removing `notifications` or `winger` from `local` leaves all other endpoints working.
- No service's Prisma schema references another service's tables (static check).
- The sale saga leaves no partial writes on stock-reservation failure.
