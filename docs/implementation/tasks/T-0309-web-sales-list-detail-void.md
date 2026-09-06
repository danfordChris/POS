# T-0309 Web — Sales List / Detail / Void

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/web-app-spec.md` (`/sales`), `docs/design/interfaces/api-contract.md` (Sales & receipts), `docs/design/interfaces/ui-design-system.md`
- Constraints: browser never holds a token (httpOnly cookies + `lib/tenant-api.ts` server client + server actions, as in the catalog/alerts screens); every API failure via the error-by-code component; neumorphic kit only, no hard-coded color/radius/shadow; `GET /sales` is Owner-all / Staff-own (server passes the caller's context — the server client already scopes); **void is Owner-only** — hide the void control for Staff and guard the action server-side; a `void` is a confirmed action.
- Do not touch: `services/*`, `mobile/`, auth/proxy plumbing.

## Objective

Add `/sales` (list) and `/sales/[id]` (detail + void) to `web/`.

## Scope Boundary

**In scope:**
- `web/app/(shell)/sales/page.tsx` + `loading.tsx` — server `tenantGet('/sales', { cursor })`; table (number, date, total, status badge, line count) with cursor "load more"; empty state; row → `/sales/[id]`. Sidebar link already exists.
- `web/app/(shell)/sales/[id]/page.tsx` — server `tenantGet('/sales/{id}')`; header (number, date, status, `sold_by` label if available), line table (name, unit price, qty, discount, line total), totals, a "View public receipt" link to `${WEB_BASE_URL}/v1/r/{public_token}` (opens the edge route), and — Owner only — a "Void sale" button.
- `web/app/(shell)/sales/actions.ts` — `voidSale(id, prev, fd)` server action: `tenantSend('POST', '/sales/{id}/void')`; `ApiError` → error state; success → `revalidatePath('/sales')` + `/sales/{id}`. A confirm step (native `confirm` or a small dialog) before the action fires.
- `web/lib/models.ts` — `Sale`, `SaleLine`, `SaleSummary` types.
- `GET /sales/{id}` 404 → the not-found UI; a voided sale shows the `voided` badge and disables the void button.

**Out of scope:**
- Creating a sale from web (sell flow is mobile-only in MVP).
- CSV export of sales.

## Acceptance Criteria

- `/sales` lists the caller's visible sales newest-first with working "load more"; an empty business shows the empty state.
- `/sales/[id]` renders line snapshots + totals + a working public-receipt link; `GET` 404 → not-found UI.
- As Owner, "Void sale" on a `completed` sale calls `POST /sales/{id}/void`, and after revalidation the page shows `voided` + a disabled button; a server error renders via the error-by-code component.
- As Staff, the void button is not rendered and the `voidSale` action returns `role_forbidden` if invoked.
- `pnpm --filter web lint` + `pnpm --filter web build` pass; no hard-coded color/radius/shadow literals in the new files.

## Dependencies

- T-0304 (void), T-0306 (list/detail)

## Implementation Checklist

1. `Sale` types in `lib/models.ts`.
2. `/sales` list page + `loading.tsx` + cursor paging.
3. `/sales/[id]` detail page + public-receipt link.
4. `actions.ts` `voidSale` + confirm; Owner-only button.
5. `pnpm --filter web lint` + `build`; validator.

## Verification

Delivered:

- `web/lib/models.ts` — `SaleLine`, `SaleSummary`, `Sale`.
- `web/app/(shell)/sales/page.tsx` (replaces the stub) + `loading.tsx` —
  server `tenantGet('/sales', { cursor, limit: 25 })`; table (number → link,
  date, line count, total, status `Badge`); `EmptyState` when none; cursor
  "Load more" via a `Link` query param; `ErrorCard` on load failure.
- `web/app/(shell)/sales/[id]/page.tsx` — server `tenantGet('/sales/{id}')`;
  header (number + status badge, timestamp, customer label, voided-at); line
  table (item, unit, qty, discount, line total) + subtotal / discount / total;
  "View public receipt ↗" → `${API_BASE_URL}/v1/r/{public_token}` (new tab);
  Owner-only `<VoidSaleButton>`. `GET` 404 → `ErrorCard`.
- `web/components/sales/VoidSaleButton.tsx` — client; `useActionState(voidSale
  .bind(null, id))`, native `confirm()` guard, disabled when already `voided`,
  `ErrorCard` on a server error.
- `web/app/(shell)/sales/actions.ts` — `voidSale(id, prev, fd)` →
  `tenantSend('POST', '/sales/{id}/void')`; `ApiError` → error state; success →
  `revalidatePath('/sales' , '/sales/{id}')`.

Evidence:

- `pnpm --filter web lint` clean; `pnpm --filter web build` → exit 0
  (`/sales` and `/sales/[id]` listed as `ƒ` dynamic). `grep` for
  `#hex | rgb() | shadow-[ | rounded-[` in the new files → none.
- Live smoke through Kong (`:8000`, local stack with the rebuilt `sales`
  container) — the exact calls the pages make:
  - `POST /sales` (qty 2 × 1500) → sale #1, `total 3000`, receipt token.
  - `GET /sales` → 1 row `{ number:1, status:'completed', total:3000,
    line_count:1, created_at }`.
  - `GET /sales/{id}` → full detail (1 line, receipt present).
  - `GET /v1/r/{token}` → public payload (business name + lines + totals).
  - `POST /sales/{id}/void` → `status:'voided'`, `receipt.status:'void'`;
    a follow-up `GET /v1/r/{token}` → `404`.
- Staff path: the void button is only rendered for `session?.role === 'owner'`
  (same guard as the other Owner-only controls); the `voidSale` action returns
  `role_forbidden` from the server if invoked otherwise.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
