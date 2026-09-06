# T-0306 Sales — List + Detail with Role Scoping

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (`GET /sales` "Owner (all); Staff (own)", `GET /sales/{id}` "Owner; Staff (own)"), `docs/design/interfaces/api-contract.md` (pagination `?limit=` + `?cursor=`)
- Constraints: both routes behind `InternalContextGuard` + `TenantGuard` + `RolesGuard('owner','staff')`; **Staff sees only sales where `sold_by = <their user_id>`** (from the internal context), Owner sees all for the business; cursor pagination newest-first; `GET /sales/{id}` for a sale the caller may not see → `404` (not `403`, to avoid leaking existence); responses carry line snapshots + the `receipt.public_token`, no other internal ids beyond `sale.id`.
- Do not touch: `services/inventory`, `catalog`, `web/`, `mobile/`.

## Objective

Add `GET /v1/businesses/{businessId}/sales` and `GET .../sales/{id}` with Owner-all / Staff-own scoping.

## Scope Boundary

**In scope:**
- `ListSalesQuery` (`limit` 1–100 default 25, `cursor`, optional `status`).
- `SalesService.listSales(businessId, role, userId, q)` — `where` adds `soldBy: userId` when `role === 'staff'`; order `created_at desc, id desc`; `{ data: [...], next_cursor }`.
- `SalesService.getSale(businessId, role, userId, id)` — tenant-scoped fetch; if `role === 'staff' && sale.soldBy !== userId` → `404 not_found`.
- View mappers: sale summary (`id`, `number`, `status`, `total`, `currency`, `created_at`, `line_count`) for the list; full detail (+ `lines[]`, `receipt.public_token`, `voided_at`) for `getSale`.
- e2e.

**Out of scope:**
- CSV export (not in the spec row for sales).
- Filtering by date range / product — not in MVP scope.

## Acceptance Criteria

- Owner `GET /sales` returns every sale for the business; Staff `GET /sales` returns only sales they created; both paginate newest-first with a working `cursor`.
- Owner `GET /sales/{id}` returns any sale; Staff `GET /sales/{id}` returns their own sale and `404` for another user's sale in the same business.
- A sale from another business is never returned (cross-tenant probe).
- `GET /sales/{unknown}` → `404 not_found`.
- Detail includes `lines[]` snapshots + `receipt.public_token`; no `product_id` join leakage beyond the stored `sale_line.product_id`.

## Dependencies

- T-0302

## Implementation Checklist

1. Query DTO + list/detail service methods with the Staff-own filter.
2. View mappers (summary vs detail).
3. Controller routes + guards.
4. e2e: Owner-all, Staff-own list + detail, cross-tenant, 404 matrix, cursor.
5. `pnpm --filter @pos/sales test`, `pnpm -r build/lint`; validator.

## Verification

Delivered:

- `ListSalesQuery` (`limit` 1–100, `cursor`, optional `status`).
- `SalesService.listSales(businessId, role, userId, q)` — `where.soldBy = userId`
  when `role === 'staff'`; `orderBy id desc` (uuidv7 is time-ordered);
  cursor = `id < q.cursor`; `{ data: SaleSummaryView[], next_cursor }`.
  `getSale(...)` — tenant-scoped fetch; `404 not_found` when missing **or**
  `role === 'staff' && sale.soldBy !== userId` (never `403`, to hide existence).
- Views: `toSaleSummary` (`id`, `number`, `status`, `total`, `currency`,
  `line_count`, `created_at`); `getSale` reuses `toSaleView` (lines +
  `receipt.public_token`).
- `SalesController` `GET /businesses/:businessId/sales` and `GET .../:id`
  (`@Roles('owner','staff')`, `role` + `user_id` from the request).

Evidence:

- `pnpm --filter @pos/sales test` → 20 (4 new): Owner list returns all 3 sales,
  Staff list returns only their 2; `limit`/`cursor` pages newest-first
  (2 then 1, `next_cursor` null at the end); Staff detail → own sale `200`,
  another user's sale `404`; Owner reads any, unknown id `404`, a sale from
  another business `404` (cross-tenant).
- Backend suites green: contracts 10, nest-common 16, testing 5, identity 7,
  tenancy 9, catalog 11, inventory 24, sales 20, notifications 22.
- `pnpm --filter @pos/sales build` + `lint` clean; `prettier` clean;
  `contracts-compat` OK.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
