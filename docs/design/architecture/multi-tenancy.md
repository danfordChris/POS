# Multi-Tenancy and Isolation

## Context

- Core promise: a business's data is invisible to other businesses and to the platform vendor.
- Isolation must hold even if application code has a bug.

## Requirements

### Tenant model

- Tenant = a business (owned by the `tenancy` service). `business_id` is the tenant key across every service.
- Every tenant-owned table in every service carries a non-null `business_id` column. Cross-service references are by id only (no cross-DB FKs).
- A user is a global identity owned by `identity`. Access to a tenant is granted only by a `membership` (owner/staff) or `winger_account` — both owned by `tenancy`/`winger`.

### Isolation layers (defense in depth)

1. **Edge auth**: only the `gateway` verifies the user JWT. It rejects operator-audience tokens on data routes and resolves the caller's membership via `tenancy.resolveMembership`. The token never identifies a business — `business_id` comes from the path + membership.
2. **Internal context**: the gateway forwards a signed internal context (`request_id`, `user_id`, `business_id`, `role`, `token_kind`) on every downstream call. A service that receives a missing/invalid context fails the request (5xx, logged) and never falls back to client input.
3. **Application scope**: inside each service, every tenant-table access goes through `runInTenantContext(business_id, fn)` (`@pos/nest-common`) — `AsyncLocalStorage` context + a transaction. `assertTenantContext()` throws for any path that skips it. (Prisma 6 removed `$use`; enforcement is this wrapper plus layer 4.)
4. **Database RLS**: each service's schema (in the shared PostgreSQL instance) has Row-Level Security on its tenant tables, keyed to the `app.business_id` GUC set per transaction via `set_config('app.business_id', <id>, true)`. Each service connects as a **non-superuser** role granted only on its own schema, with `FORCE ROW LEVEL SECURITY`.
5. **Serialization**: role-aware DTOs. The `winger` service's DTO whitelists fields; internal fields cannot be added by accident.

### Platform operator policy

- Operator tokens have audience `operator`; rejected by all data-plane routes.
- Control-plane may read only: business id, name, `subscription_status`, and aggregate counts (products, members) — never row contents.
- Break-glass: `SupportAccessGrant` requires `business_id`, `reason`, Owner approval, and `expires_at` (max 24h). Every access under a grant writes an `AuditLog` row visible to the Owner.
- No grant → operator queries on tenant tables return 403 at the app layer and are blocked by RLS.

### Cross-tenant interaction

- None in MVP except: a single `User` may hold memberships in multiple businesses and switches context explicitly. Each context is fully isolated.
- Winger authorization is initiated by the Owner only; a winger cannot request access.

### Threats and mitigations

| Threat | Mitigation |
|---|---|
| IDOR: caller passes another `business_id` | Gateway membership check per request → 403 |
| Missing app-layer filter in a service | That service's RLS blocks the rows anyway |
| Forged/replayed internal context | Signed context, short expiry, `request_id`; services reject invalid |
| A service subscribing to another tenant's events | Consumers filter by `business_id`; event streams are not tenant-partitioned but handlers are tenant-scoped |
| Over-fetching in a DTO | Field whitelist in the winger DTO + schema test |
| Operator curiosity | Audience split at the gateway + per-service RLS + audit log + time-boxed grants |
| Backup / export leak | Exports run per-business through each service's tenant scope and are composed by the gateway |

## Decisions

- One shared PostgreSQL instance; a schema + non-superuser role per service, each with RLS on its tenant tables (see decision 0002). Not DB-per-tenant, not DB-per-service.
- `business_id` is resolved once at the gateway and propagated; services never derive it from client input.
- Grant lifetime capped at 24h; no indefinite operator access.
- Tenant context is per transaction, set from the propagated `business_id`.

## Contracts

- `set_config('app.business_id', <id>, true)` runs first inside every data-plane transaction.
- RLS policy: `<tenant_col> = nullif(current_setting('app.business_id', true), '')::uuid` — added by the reusable `enable_tenant_rls('<table>')` SQL helper. Denies by default when the GUC is unset or empty.

## Acceptance Criteria

- Test (per service with tenant tables): a query without `app.business_id` set returns zero rows.
- Test: a member of business A gets 403 at the gateway on every business-B route.
- Test: a downstream service call with no internal context is rejected, not served.
- Test: operator token gets 403 at the gateway on data routes; with an active grant, access succeeds and writes an `AuditLog` row.
- Test: the winger DTO snapshot contains only whitelisted fields.
