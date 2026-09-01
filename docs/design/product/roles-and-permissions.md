# Roles and Permissions

## Context

- Roles are per business (a user can be Owner in one business and Staff in another).
- MVP roles: Owner, Staff, Winger. Manager deferred.
- Platform operator is not a tenant role; it lives in the control-plane.

## Requirements

### Permission matrix (MVP)

| Capability | Owner | Staff | Winger |
|---|---|---|---|
| View catalog (internal fields: cost, quantity) | ✅ | ✅ | ❌ |
| Create / edit / deactivate product | ✅ | ✅ | ❌ |
| Set cost price, sell price, winger price | ✅ | ❌ | ❌ |
| Record stock-in / adjustment | ✅ | ✅ | ❌ |
| View stock movement history | ✅ | ✅ | ❌ |
| Process / void sale | ✅ | ✅ | ❌ |
| View sales history & reports | ✅ | own sales only | ❌ |
| Configure reorder thresholds & alert recipients | ✅ | ❌ | ❌ |
| Invite / suspend / remove Staff | ✅ | ❌ | ❌ |
| Authorize / suspend Winger | ✅ | ❌ | ❌ |
| Upload product image | ✅ | ✅ | ❌ |
| Winger catalog view (name, price, in-stock flag) | ✅ | ✅ | ✅ (authorized business only) |
| See quantities, cost, margin, members, other businesses | ✅ | partial (no cost/margin) | ❌ |

### Winger access rules

- A `WingerAccount` binds one user to exactly one business.
- Winger price resolution: `product.winger_price` if set, else `product.sell_price`.
- Stock signal is a boolean only: `in_stock = on_hand > 0`. Never expose the number.
- Suspended winger: all winger endpoints return 403.
- Winger has no access to any non-winger route.

### Platform operator (control-plane)

| Capability | Operator |
|---|---|
| Create business, set `subscription_status` | ✅ |
| List businesses (id, name, status, counts only) | ✅ |
| Read catalog / stock / sales / prices / members | ❌ (403) |
| Break-glass support access | Only via an owner-approved, time-boxed, audit-logged `SupportAccessGrant` |

## Decisions

- Staff cannot see cost price or margin anywhere in MVP.
- Reports for Staff are limited to sales they personally processed.
- No custom roles or per-permission overrides in MVP.

## Contracts

- API enforces role at the route/handler level, not the client.
- Every tenant route resolves `business_id` and asserts the caller's membership + role before returning data.

## Acceptance Criteria

- Automated test per matrix row: allowed role returns 2xx, disallowed role returns 403.
- Winger catalog response schema contains no `quantity`, `cost_price`, `created_by`, or member fields.
- Operator token returns 403 on every `/v1/businesses/{id}/*` data route.
