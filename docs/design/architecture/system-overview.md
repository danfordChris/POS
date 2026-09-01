# System Overview

## Context

- Two clients, one backend, one database. Control-plane logically separated from the tenant data-plane.

## Requirements

### Components

| Component | Tech | Responsibility |
|---|---|---|
| Mobile app | Flutter (Android, iOS) | Floor work: catalog, scan, stock-in, sales, receipts, low-stock list |
| Web admin | Next.js | Management: members, catalog, stock history, sales, winger admin, alerts, basic reports |
| API | NestJS (TypeScript) | Auth, tenant resolution, business logic, REST endpoints (OpenAPI) |
| Database | PostgreSQL (+ Prisma) | Persistent store; RLS as isolation backstop |
| Object storage | S3-compatible | Product images |
| Email sender | Transactional email provider | Invitations, winger authorization, low-stock alerts |
| Job runner | In-process queue (e.g. BullMQ + Redis) | Async notification dispatch, alert dedupe |

### Control-plane vs data-plane

- Data-plane: all `/v1/businesses/{businessId}/*` and `/v1/winger/*` routes. Requires a tenant membership.
- Control-plane: `/v1/admin/*`. Operator identity. No access to data-plane tables except through a `SupportAccessGrant`.
- Separate auth audiences: user tokens and operator tokens are not interchangeable.

### Request flow (tenant route)

1. Client sends `Authorization: Bearer <user JWT>`.
2. API validates token, loads user.
3. API reads `businessId` from the path, loads the caller's `Membership`; rejects with 403 if none.
4. Handler runs with a tenant-scoped DB context (`business_id` bound); Prisma middleware injects the filter; Postgres RLS enforces it independently.
5. Response serialized through a role-aware DTO (winger DTO strips internal fields).

### Data flow examples

- Sale: client → `POST .../sales` → transaction: insert `sale` + `sale_line` + `stock_movement(type=sale)` rows, recompute on-hand → enqueue receipt token → respond.
- Low-stock: stock movement handler computes new on-hand → if `≤ threshold` and no open alert → insert `notification(low_stock)` → job runner sends email → mark alert open until on-hand rises above threshold.

### Environments

- `local`, `staging`, `production`. Each with isolated database and storage bucket.
- Provider-agnostic deploy: container images + managed Postgres + managed Redis. Target chosen in Phase 00.

## Decisions

- One shared database with row-level tenant scoping, not database-per-tenant (revisit if a tenant needs physical isolation).
- Synchronous business writes; only notification delivery is async.
- No GraphQL; REST + OpenAPI.

## Contracts

- API is the only writer to the database.
- Clients hold no business rules that the API does not also enforce.

## Acceptance Criteria

- A running stack in `local` serves the mobile app and web admin against the same API.
- Removing the Prisma tenant filter still yields zero cross-tenant rows in tests (RLS backstop proven).
- Operator token cannot reach any data-plane table without an active `SupportAccessGrant`.
