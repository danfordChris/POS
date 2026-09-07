# T-0602 `sales` — Customers CRUD + Accounts-Receivable Rollup

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/product/invoicing-and-credit.md` (Customer,
  Accounts receivable, Roles), `docs/design/interfaces/api-contract.md`
  (`Invoicing & credit` — customer rows), `docs/design/data/data-model.md`
  (`customer`, `outstanding_balance` derived + cached)
- Constraints: `services/sales` only; `customer` is a tenant table with forced
  RLS; `outstanding_balance` is derived (`sum(invoice.balance_due)` over
  non-void invoices) and cached on the row — never client-supplied; no hard
  delete while any non-void invoice exists (use `disabled_at`); Owner + Staff
  may create/edit customers.
- Do not touch: invoice/payment write paths (T-0603/T-0604) beyond reading
  `invoice.balance_due_minor` for the rollup; other services; `web`, `mobile`.

## Objective

An Owner or Staff can create, edit, list, and fetch customers for a business,
and list which customers currently owe money, with balances computed from the
invoice ledger.

## Scope Boundary

**In scope:**
- `POST /v1/businesses/{businessId}/customers` — `{ name, phone?, email?,
  address?, tax_id? }` → `201` with the row (`outstanding_balance: 0`);
  `CustomerCreated` to the outbox.
- `GET /v1/businesses/{businessId}/customers` — `?q=` (name/phone/email
  substring), `?has_balance=true` (only non-zero derived balance); paginated.
- `GET /v1/businesses/{businessId}/customers/{id}` — includes the live
  `outstanding_balance` and a small recent-invoice summary.
- `PATCH /v1/businesses/{businessId}/customers/{id}` — mutable fields +
  `disabled_at`; `CustomerUpdated` to the outbox.
- A shared helper that recomputes + caches `customer.outstanding_balance` inside
  a transaction, callable from T-0603/T-0604 (export it).
- Kong route `/v1/businesses/{id}/customers` (+ `.../customers/{id}`) in
  `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`.
- e2e specs in `services/sales`.

**Out of scope:**
- Invoice creation, payments (T-0603/T-0604).
- Web/mobile customer UI (T-0607/T-0608).
- Merge/dedupe customers (backlog).

## Acceptance Criteria

- `POST .../customers` returns `201`, persists the row, and publishes exactly one
  `CustomerCreated`; missing `name` → `400 validation_error`.
- `GET .../customers?has_balance=true` returns only customers of that business
  with a derived balance `> 0`; a cross-tenant `businessId` returns an empty list
  (forced RLS).
- `GET .../customers/{id}` reflects the sum of that customer's non-void invoice
  balances; a `PATCH` with `disabled_at` hides the customer from the default
  list but keeps it fetchable by id.
- A Winger or operator token on any `.../customers` route → `403`.
- `pnpm --filter @pos/sales build test lint` green; `kong config parse` OK;
  `kubectl kustomize infra/k8s/base` renders.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.

## Dependencies

- T-0601 (`customer` model + `CustomerCreated`/`CustomerUpdated` contracts).

## Implementation Checklist

1. `CustomersService` — create/list/get/patch + the balance-recompute helper.
2. `CustomersController` — the four routes, Owner+Staff gate, pagination.
3. Outbox writes for `CustomerCreated` / `CustomerUpdated`.
4. Kong routes in both config files.
5. e2e specs (happy path, `has_balance` filter, RLS scoping, role gates).
6. Build/test/lint; kustomize; kong parse; validator.

## Verification

Delivered:

- `services/sales/src/customers/` — `CustomersService` (`create` / `list` /
  `get` / `update` + `static recomputeOutstandingBalance(tx, businessId,
  customerId)` exported for T-0603/T-0604), `CustomersController`
  (`@Controller('businesses/:businessId/customers')`,
  `InternalContextGuard` + `TenantGuard` + `RolesGuard`, Owner+Staff), DTOs
  (`create` / `update` / `list`), `customers-views.ts`.
  - `list`: newest-first cursor pagination on the time-ordered `id`; `?q=`
    (name/phone/email `contains`, insensitive); `?has_balance=true`
    (`outstandingBalance > 0`); disabled customers hidden from the default list.
  - `get`: `outstanding_balance` (cached) + `recent_invoices` (last 10).
  - `update`: partial; `disabled:true/false` toggles `disabled_at`; nulls clear
    optional fields.
  - `create` / `update` write `CustomerCreated` / `CustomerUpdated` to the
    outbox in the same tenant txn (email/phone only when present, per the
    `.email()` schema).
- `sales.module.ts` — `CustomersController` + `CustomersService` registered and
  exported.
- Kong — `sales-customers-tenant` route (`~/v1/businesses/[^/]+/customers`,
  `require_business_scope: true`) in `infra/kong/kong.yml` +
  `infra/k8s/base/kong-config.yaml`.

Evidence:

- `services/sales/test/customers.e2e-spec.ts` — **7 passing**: create (trims,
  lowercases email, one `CustomerCreated`); no name → `400 validation_error`;
  list order + `?q=` + `?has_balance=true` empty; get zero-balance +
  `recent_invoices: []`, unknown → `404`; `disabled:true` hides from list /
  still fetchable / `CustomerUpdated` carries `disabled:true`; cross-tenant list
  empty (forced RLS); operator token → `403 operator_data_access_denied`,
  wrong-business context → `403 not_a_member`.
- All `services/sales` specs green in isolation: customers 7, sales 18,
  isolation 13, rls-backstop 15, scaffold 2. (`pnpm -r`-style shared-Postgres
  pool contention still flakes `sales.e2e-spec.ts` when the compose stack is
  attached — passes alone; CI runs a dedicated DB.)
- `pnpm --filter @pos/sales build lint` green;
  `node scripts/check-contracts-compat.mjs HEAD` → OK;
  `kong config parse` → `parse successful`;
  `kubectl kustomize infra/k8s/base` renders.
- Live smoke through the local Kong edge (sales image rebuilt): register →
  create business → `POST /v1/businesses/{id}/customers` returns the row
  (`outstanding_balance: 0`); `GET .../customers`, `?q=ash`, and
  `?has_balance=true` (empty) all behave.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.
