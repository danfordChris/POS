# T-0603 `sales` — Credit Sale → Invoice Issuance + Public `/v1/i/{token}`

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/product/invoicing-and-credit.md` (Invoice §
  "From a credit sale", public view, Decisions), `docs/design/interfaces/api-contract.md`
  (`POST /sales` extension; `GET /i/{token}`; `customer_required`),
  `docs/design/interfaces/events-catalog.md` (`InvoiceIssued`),
  `docs/design/data/data-model.md` (`invoice`, `invoice_number_counter`,
  invariants)
- Constraints: `services/sales` only; reuse the existing sale saga
  (reserve→write→commit) — credit is a **payment term**, the invoice is a side
  effect of completing a `credit` sale, not a new endpoint; per-business
  `number` from `invoice_number_counter` row-locked (`SELECT … FOR UPDATE`) in
  the issue txn, same as `sale_number_counter`; `public_token` unguessable
  (≥128-bit); business name + lines snapshotted onto the `invoice` row;
  `due_date = issue_date + INVOICE_NET_DAYS` (env, default 14); `InvoiceIssued`
  via the outbox in the same txn.
- Do not touch: payments, standalone invoice create, void (T-0604); `media`,
  `notifications`, `web`, `mobile`.

## Objective

Completing a sale with `payment_terms: credit` and a `customer_id` issues exactly
one `issued` invoice (`balance_due == total`, unique per-business number) in the
same transaction as the sale, and the invoice is viewable at an unauthenticated
`GET /v1/i/{token}`.

## Scope Boundary

**In scope:**
- `POST /v1/businesses/{businessId}/sales` gains `payment_terms`
  (`cash`|`credit`, default `cash`) and `customer_id`; `credit` with no
  `customer_id` → `400 customer_required`; `credit` with a `customer_id` not in
  the business → `400 validation_error`.
- On a completed `credit` sale: allocate the invoice number, insert `invoice` +
  `invoice_line` rows (snapshots from the sale lines), set `status = issued`,
  `amount_paid_minor = 0`, `balance_due_minor = total_minor`, bump the customer's
  cached `outstanding_balance` (via the T-0602 helper), write `InvoiceIssued` to
  the outbox — all in the sale transaction (no partial invoice on saga failure).
- `GET /v1/businesses/{businessId}/invoices` + `GET .../invoices/{id}` read
  paths (list filters `?status=` `?customer_id=` `?overdue=true`; Owner sees all,
  Staff sees own) — enough to view an issued invoice; deeper mutation is T-0604.
- `GET /v1/i/{public_token}` — public, no auth; fixed snapshot payload
  (business name, lines, totals, balance, status); `404` for unknown or `void`.
- Kong routes `/v1/businesses/{id}/invoices` (+ `/{id}`) and `/v1/i/{token}`
  (`require_business_scope: false`) in both config files.
- `INVOICE_NET_DAYS` in `services/sales` env + `.env.example`.
- e2e + a contract/whitelist test for the public payload.

**Out of scope:**
- `POST /invoices` standalone, payments, void (T-0604).
- PDF (`/pdf` route + `media`) — T-0605.

## Acceptance Criteria

- A `credit` sale returns `201`, decrements stock exactly as a cash sale, and
  creates exactly one `issued` invoice with `balance_due_minor == total_minor`
  and a `number` unique within the business; exactly one `InvoiceIssued` is
  published.
- A `credit` sale with no `customer_id` → `400 customer_required`; a `cash` sale
  is unchanged (no invoice, no `InvoiceIssued`).
- Saga failure (reservation shortfall) on a `credit` sale leaves no `sale`,
  `invoice`, or `InvoiceIssued` — asserted.
- `GET /v1/i/{token}` returns `200` with no `Authorization` header and `404` for
  an unknown/void token; the payload validates against the whitelist (no
  `cost_price`, `customer` PII beyond name, member, or cross-customer fields).
- The customer's `outstanding_balance` increases by the invoice total.
- Concurrent `credit` sales for one business never collide on `number`
  (row-locked counter) — asserted under ≥ 10 parallel requests.
- `check-contracts-compat.mjs HEAD` OK; `pnpm --filter @pos/sales build test
  lint` green; `kong config parse` OK; `kubectl kustomize infra/k8s/base`
  renders; `validate_workflow.py` → `WORKFLOW:ok`.

## Dependencies

- T-0601 (schema + `InvoiceIssued` contract), T-0602 (`customer` + balance
  helper).

## Implementation Checklist

1. Extend the `POST /sales` DTO + validation (`payment_terms`, `customer_id`,
   `customer_required`).
2. In the sale txn, on `credit`: allocate number, write invoice + lines,
   update customer balance, outbox `InvoiceIssued`.
3. Invoice list + get read endpoints.
4. `GET /v1/i/{token}` public controller + snapshot payload + whitelist test.
5. Kong routes; `INVOICE_NET_DAYS` env; `.env.example`.
6. e2e (credit happy path, `customer_required`, saga-failure cleanup, public
   token, counter concurrency); build/test/lint; kustomize; kong parse;
   compat; validator.

## Verification

_Planned — to be filled on completion:_

- `pnpm --filter @pos/sales test` (credit-sale + public-invoice + counter-
  concurrency specs) + `build` + `lint`.
- `node scripts/check-contracts-compat.mjs HEAD`.
- `kong config parse` + `kubectl kustomize infra/k8s/base`.
- Live smoke through Kong: credit sale → `GET /v1/i/{token}` logged out.
- `validate_workflow.py` → `WORKFLOW:ok`.
