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
2. **Application scope**: Prisma middleware requires a bound `business_id` for every query on a tenant-owned model; unbound queries throw.
3. **Database RLS**: PostgreSQL Row-Level Security policy on every tenant-owned table keyed to a `SET app.business_id` per transaction. Independent of application code.
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

- `SET app.business_id = <id>` wraps every data-plane transaction.
- RLS policies deny by default when `app.business_id` is unset.

## Acceptance Criteria

- Test: query without `app.business_id` set returns zero rows for every tenant table.
- Test: member of business A gets 403 on every business B route.
- Test: operator token gets 403 on data routes; with an active grant, access succeeds and writes an `AuditLog` row.
- Test: winger DTO snapshot contains only whitelisted fields.
