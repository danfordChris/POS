# Web Admin Spec — MVP

## Context

- Next.js. Audience: Owner (primary) and Staff (limited). Wingers do not use the web app in MVP.
- Management and history tasks that are awkward on mobile.
- Locales: en, sw.

## Requirements

### Routes

| Route | Access | Content |
|---|---|---|
| `/login` | public | email + password |
| `/accept-invite?token=` | public → auth | set password, join as Staff |
| `/` (dashboard) | member | sales summary, stock value (Owner), low-stock list, open support grants (Owner) |
| `/catalog` | Owner, Staff | product table: search, filter by category/active, inline on-hand; Staff sees no cost/margin columns |
| `/catalog/new`, `/catalog/[id]` | Owner, Staff | full product form; price fields Owner-only |
| `/stock` | member | current on-hand table + CSV export |
| `/stock/movements` | member | ledger with filters (product, type, date range) |
| `/sales` | Owner (all), Staff (own) | sales table, drill to lines, open receipt link |
| `/sales/[id]` | Owner, Staff (own) | sale detail, void (Owner) |
| `/wingers` | Owner | authorize user (email/phone), list, suspend/reactivate; set per-product winger price; upload product images |
| `/members` | Owner | invite Staff, list, suspend/remove |
| `/alerts` | Owner | recipients, min interval |
| `/reports` | Owner | sales by day, top products, stock value, low-stock — current business only |
| `/settings` | Owner | business name, currency, locale, timezone |
| `/support` | Owner | review/approve/revoke `SupportAccessGrant`; view audit log of operator access |

### Behaviors

- All data fetching scoped to the selected business; a business switcher in the header when the user has >1.
- Server-side auth guard per route; role guard for Owner-only routes → 403 page.
- Every mutation is a server action calling the API with the user token; errors surfaced by `error.code` with a retry affordance; wrapped in try/catch.
- CSV exports (`/stock`, `/reports`) run through the same tenant scope as the API.
- No cost price, margin, or supplier data rendered for Staff anywhere.

## Decisions

- Winger price editing and product image upload are web-only in MVP (bulk-friendly); mobile can upload a single image but not set winger price.
- Reports are read-only summaries, no export scheduling.

## Contracts

- Routes map to `api-contract.md` endpoints; the web app holds no independent business rules.
- Winger-related screens never expose winger login credentials; they authorize an existing user identity.

## Acceptance Criteria

- Staff visiting an Owner-only route gets the 403 page, not data.
- `/support` shows every operator access event for the business with timestamp, operator, and reason.
- Switching business context reloads all lists with the new `business_id` and no stale rows.
