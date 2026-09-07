# T-0602 `sales` — Customers CRUD + Accounts-Receivable Rollup

## Status

- `pending`
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

_Planned — to be filled on completion:_

- `pnpm --filter @pos/sales test` (new customers spec) + `build` + `lint`.
- `kong config parse` + `kubectl kustomize infra/k8s/base`.
- Live smoke through Kong: create a customer, list with/without `has_balance`.
- `validate_workflow.py` → `WORKFLOW:ok`.
