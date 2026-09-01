# T-0113 services/tenancy

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md`, `docs/design/architecture/multi-tenancy.md`, `docs/design/interfaces/internal-rpc.md`, `docs/design/interfaces/events-catalog.md`, `docs/design/data/data-model.md`
- Constraints: own schema only (`tenancy` in the shared Postgres, role `tenancy_app`) with RLS; `business_id` only from the internal context; try/catch around transaction setup.
- Do not touch: `identity`, `gateway`, catalog/inventory code.

## Objective

`services/tenancy` owns `business` / `membership` (and later `invitation`), enforces per-DB RLS, serves business CRUD behind the gateway and the `resolveMembership` RPC, and emits business/membership events.

## Scope Boundary

**In scope:**
- New NestJS service; own Prisma schema + migration for `business`, `membership` + `enable_tenant_rls()` (relocated from `api/prisma`).
- Relocate `api/src/businesses/*` + `api/src/tenancy/*`; the `TenantGuard` becomes internal-context validation (no JWT parsing — the gateway already did that).
- HTTP routes (under `/v1/businesses/*`): `POST /businesses`, `GET /businesses/:id`, `PATCH /businesses/:id` (owner-only via `RolesGuard`).
- NATS RPC: `pos.rpc.tenancy.resolveMembership` → `{ found, role, status }`.
- NATS RPC client: `pos.rpc.identity.getUser` (used when linking a user).
- Emit `BusinessCreated`, `MembershipCreated`, `MembershipSuspended` via outbox.
- `/healthz`, `/readyz`, Dockerfile, k8s overlay.

**Out of scope:**
- Invitations endpoints (separate task, Phase 01/02).
- Support-access grants (Phase 06).

## Acceptance Criteria

- [ ] `prisma migrate deploy` on `tenancy_db` creates `business`, `membership`, RLS policies (`relforcerowsecurity = t`).
- [ ] `POST /businesses` creates the business + an owner `membership` in one tenant-scoped transaction.
- [ ] `resolveMembership(business_id, user_id)` returns the active membership or `found:false`.
- [ ] A request with no / invalid internal context is rejected (5xx), never served.
- [ ] Raw query on `business`/`membership` with no `app.business_id` → 0 rows; raw insert → RLS rejection.
- [ ] `BusinessCreated` + `MembershipCreated` written to the outbox in the create transaction and published.
- [ ] Staff calling `PATCH /businesses/:id` → 403 `role_forbidden`.

## Dependencies

- T-0110, T-0111, T-0112, T-0115

## Implementation Checklist

- [ ] Scaffold `services/tenancy`; wire `@pos/nest-common`.
- [ ] Move Prisma schema (business, membership, RLS helper) + migration; `TENANCY_DATABASE_URL` with the non-superuser role.
- [ ] Move `businesses/*` + `tenancy/*`; replace JWT parsing in `TenantGuard` with internal-context validation.
- [ ] Add `resolveMembership` RPC handler + `identity.getUser` client.
- [ ] Add event emits via outbox; health; Dockerfile; k8s overlay.
- [ ] Port the T-0004 tenancy e2e suite to this service.

## Verification

- Command: `pnpm --filter @pos/tenancy test && pnpm --filter @pos/tenancy exec prisma migrate deploy`
- Evidence: test report, `psql` RLS check, and a captured `BusinessCreated` message, pasted into the PR.
