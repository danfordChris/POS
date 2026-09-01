# Service Architecture — Residual Open Items

## Status

proposed

## Context

- Decided 2026-09-01: **Option B — microservices from day one**.
- Adopted into `docs/design/`: `architecture/system-overview.md` (rewritten), `architecture/service-decomposition.md` (new), `architecture/multi-tenancy.md` (updated), `interfaces/events-catalog.md` + `interfaces/internal-rpc.md` (new), `integrations/README.md` (NATS), `decisions/0002-microservices.md`.
- Implementation re-planned: `phase-01-platform` inserted; feature phases renumbered 02–06.

## Problem

- A few defaults were adopted without an explicit answer. They are marked in the design docs and can be changed before Phase 01 starts.

## Proposed Change

Confirm or override these adopted defaults:

1. **Broker**: NATS + JetStream (events + request/reply). Alternative: RabbitMQ.
2. **Sync inter-service calls**: NATS request/reply (single messaging substrate). Alternative: gRPC for typed hot paths.
3. **Data**: database-per-service (separate PostgreSQL database per service; one cluster in dev, separate in prod). No cross-service SQL.
4. **Tenant isolation**: `business_id` propagated in request/message context by the gateway; each tenant-owning service keeps the `runInTenantContext` + `enable_tenant_rls` pattern in its own DB.
5. **Production orchestration**: Kubernetes. Local: `docker-compose` with all services + NATS + per-service Postgres + MinIO + Mailpit.
6. **Auth trust boundary**: only the gateway verifies the user JWT; it injects a signed internal context (`user_id`, `business_id`, `role`, `request_id`) to downstream services, which trust the gateway on the internal network.

## Expected Design Impact

- None further unless a default above is overridden.

## Expected Implementation Impact

- Phase 01 delivers the platform + relocates T-0002/T-0003/T-0004 logic into `identity` and `tenancy` services.
