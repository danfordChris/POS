# Multi-Tenancy and Isolation

## Context

- Core promise: a business's data is invisible to other businesses and to the platform vendor.
- Isolation must hold even if application code has a bug.

## Requirements

### Tenant model

- Tenant = `Business` row. `business_id` is the tenant key.
- Every tenant-owned table carries a non-null `business_id` FK.
- A `User` is a global identity. Access to a tenant is granted only by a `Membership` (Owner/Staff) or `WingerAccount`.

### Isolation layers (defense in depth)

1. **Auth**: user JWT identifies the user only, never a business. Tenant comes from the route + membership check.
2. **Application scope**: every tenant-model access goes through `PrismaService.runInTenantContext(businessId, fn)`, which binds an `AsyncLocalStorage` context and opens a transaction. `assertTenantContext()` throws for any repository path that skips it. (Prisma 6 removed `$use` middleware; enforcement is this wrapper plus layer 3.)
3. **Database RLS**: PostgreSQL Row-Level Security on every tenant-owned table, keyed to the `app.business_id` GUC set per transaction via `set_config('app.business_id', <id>, true)`. Independent of application code. The API connects as a **non-superuser** role (`pos_app`) with `FORCE ROW LEVEL SECURITY` so the policy also applies to the table owner.
4. **Serialization**: role-aware DTOs. Winger DTO whitelists fields; internal fields cannot be added by accident.

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
| IDOR: caller passes another `business_id` | Membership check per route → 403 |
| Missing app-layer filter | RLS blocks the rows anyway |
| Over-fetching in a DTO | Field whitelist in winger/staff DTOs + schema test |
| Operator curiosity | Audience split + RLS + audit log + time-boxed grants |
| Backup / export leak | Exports are per-business and run through the same tenant scope |

## Decisions

- Shared-DB + RLS, not DB-per-tenant, for MVP.
- Grant lifetime capped at 24h; no indefinite operator access.
- Tenant context is per transaction, set from the resolved membership, never from client input.

## Contracts

- `set_config('app.business_id', <id>, true)` runs first inside every data-plane transaction.
- RLS policy: `<tenant_col> = nullif(current_setting('app.business_id', true), '')::uuid` — added by the reusable `enable_tenant_rls('<table>')` SQL helper. Denies by default when the GUC is unset or empty.

## Acceptance Criteria

- Test: query without `app.business_id` set returns zero rows for every tenant table.
- Test: member of business A gets 403 on every business B route.
- Test: operator token gets 403 on data routes; with an active grant, access succeeds and writes an `AuditLog` row.
- Test: winger DTO snapshot contains only whitelisted fields.
