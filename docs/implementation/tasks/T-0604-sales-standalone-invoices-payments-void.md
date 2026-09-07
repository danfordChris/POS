# T-0604 `sales` — Standalone Invoices + Payments + Void

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/product/invoicing-and-credit.md` (Invoice
  "Standalone", Payment, Void), `docs/design/interfaces/api-contract.md`
  (`POST /invoices`, `.../payments`, `.../void`; `overpayment`,
  `invoice_not_payable`), `docs/design/interfaces/events-catalog.md`
  (`InvoicePaymentRecorded`, `InvoiceVoided`), `docs/design/data/data-model.md`
  (balance invariants)
- Constraints: `services/sales` only; balance maths are integer minor units and
  enforced in-transaction (`balance_due == total - amount_paid`,
  `0 <= balance_due <= total`); every payment/void updates the customer's
  cached `outstanding_balance` (T-0602 helper) in the same txn; payments are
  idempotent on `Idempotency-Key`; void is **Owner-only**; a `paid` invoice
  cannot be voided; `POST /sales/{id}/void` (existing) must also void the linked
  invoice.
- Do not touch: the credit-sale issuance path (T-0603) except to call the shared
  void routine; `media`, `notifications`, `web`, `mobile`.

## Objective

An Owner/Staff can raise a standalone invoice, record payments against any
open invoice until it is `paid`, and an Owner can void an invoice (and voiding a
sale voids its invoice) — with the customer balance and invoice status kept
correct under all paths.

## Scope Boundary

**In scope:**
- `POST /v1/businesses/{businessId}/invoices` — `{ customer_id, lines[] }` or
  `{ customer_id, sale_id }` to attach to an existing cash sale; issues an
  `issued` invoice (number, snapshots, `InvoiceIssued`); **no** stock movement.
- `POST /v1/businesses/{businessId}/invoices/{id}/payments` — `{ amount_minor,
  method, reference?, received_at? }`; reduce `balance_due` + customer balance;
  flip to `partially_paid` / `paid`; `amount > balance_due` → `422 overpayment`
  (no write); `void`/`paid` target → `409 invoice_not_payable`; `Idempotency-Key`
  honoured; `InvoicePaymentRecorded` to the outbox.
- `POST /v1/businesses/{businessId}/invoices/{id}/void` — Owner only;
  `status = void`, `balance_due = 0`, customer balance −= old `balance_due`,
  `void_reason?`; `409 invoice_not_payable` if already `paid`;
  `InvoiceVoided` to the outbox. Payments are retained.
- A shared `voidInvoice(tx, invoiceId, reason)` routine; call it from
  `POST /sales/{id}/void` for the linked invoice (in that void's txn).
- Kong routes for `.../invoices` `POST`, `.../invoices/{id}/payments`,
  `.../invoices/{id}/void` in both config files.
- e2e specs.

**Out of scope:**
- `draft` invoice editing, credit notes / refunds on a `paid` invoice (backlog).
- PDF (`/pdf`) — T-0605.
- Overdue digest — T-0606.

## Acceptance Criteria

- `POST .../invoices` with lines returns `201`, issues one `issued` invoice with
  a unique `number`, publishes one `InvoiceIssued`, and moves no stock.
- Payments summing to `total_minor` flip the invoice to `paid` and drop the
  customer's `outstanding_balance` by that total; a partial payment yields
  `partially_paid`; the same `Idempotency-Key` twice records one `payment`.
- A payment exceeding `balance_due` → `422 overpayment`, nothing persisted; a
  payment against a `void` or `paid` invoice → `409 invoice_not_payable`.
- `POST .../invoices/{id}/void` by an Owner sets `void` + zero balance and
  reduces the customer balance; a Staff caller → `403`; a `paid` invoice →
  `409 invoice_not_payable`.
- `POST /v1/businesses/{id}/sales/{id}/void` on a credit sale voids the linked
  invoice by the same rule (customer balance restored, `InvoiceVoided` emitted)
  in addition to the existing stock reversal.
- Invariants hold after a randomized sequence of payments + voids (property-style
  test): `balance_due == total - amount_paid`, `outstanding_balance == Σ open
  balances`.
- `check-contracts-compat.mjs HEAD` OK; `pnpm --filter @pos/sales build test
  lint` green; `kong config parse` OK; `kubectl kustomize infra/k8s/base`
  renders; `validate_workflow.py` → `WORKFLOW:ok`.

## Dependencies

- T-0601, T-0602, T-0603.

## Implementation Checklist

1. `InvoicesService` — standalone create, `recordPayment`, `voidInvoice`
   (shared), balance/status maths, customer-balance updates.
2. `InvoicesController` — the three routes + role gates + `Idempotency-Key`.
3. Wire `voidInvoice` into the existing `SalesService` sale-void path.
4. Outbox writes for `InvoiceIssued` (standalone), `InvoicePaymentRecorded`,
   `InvoiceVoided`.
5. Kong routes in both config files.
6. e2e (standalone issue, payment→paid, idempotency, overpayment,
   not-payable, void + role gate, sale-void→invoice-void, invariant fuzz);
   build/test/lint; kustomize; kong parse; compat; validator.

## Verification

_Planned — to be filled on completion:_

- `pnpm --filter @pos/sales test` (invoices + payments + void specs) + `build` +
  `lint`.
- `node scripts/check-contracts-compat.mjs HEAD`.
- `kong config parse` + `kubectl kustomize infra/k8s/base`.
- Live smoke: standalone invoice → two payments → `paid`; void a credit sale →
  invoice `void` + balance restored.
- `validate_workflow.py` → `WORKFLOW:ok`.
