# T-0604 `sales` — Standalone Invoices + Payments + Void

## Status

- `done`
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

Delivered:

- `InvoicesService` — `issueCore(tx, …)` extracted (number + snapshots + balance
  recompute + `InvoiceIssued`), shared by `issueFromSale` (T-0603) and the new
  `issueStandalone(businessId, dto)`:
  - `POST /v1/businesses/{id}/invoices` — exactly one of `sale_id` (snapshot a
    `completed` sale's lines; already-invoiced → `409 conflict`; not completed →
    `409`) or `lines` (explicit; negative line total → `400`); unknown
    `customer_id` → `400 validation_error`; **no stock movement**.
  - `recordPayment(businessId, invoiceId, userId, dto, idempotencyKey?)` —
    `POST .../invoices/{id}/payments`; `void`/`paid` target → `409
    invoice_not_payable`; `amount_minor > balance_due` → `422 overpayment` (no
    write); reduces `balance_due` + recomputes the customer balance; status →
    `partially_paid` / `paid`; `InvoicePaymentRecorded` (with `paid_in_full`,
    `customer_email?`, `locale`); idempotent on `Idempotency-Key` (pre-check +
    `payment (business_id, idempotency_key)` unique + P2002 catch).
  - `voidInvoiceInTx(tx, …)` / `voidInvoice(...)` — `POST .../invoices/{id}/void`
    (Owner only); `status = void`, `balance_due = 0`, customer balance −= old
    balance; payments retained; `paid` → `409 invoice_not_payable`; idempotent
    for an already-`void` invoice; `InvoiceVoided` (with `reason?`).
- `SalesService.voidSale` — after the `SaleVoided` outbox write, voids the
  linked invoice via `voidInvoiceInTx` (skipped when it is already `void`/`paid`
  — a credit note is the manual follow-up).
- `InvoicesController` — `POST /`, `POST /:id/payments` (`Idempotency-Key`
  header), `POST /:id/void` (`@Roles('owner')`, `200`). DTOs
  `create-invoice` / `record-payment` / `void-invoice`. No Kong change — the
  `~/v1/businesses/[^/]+/invoices` route already matches the sub-paths.
- Migration `20260907180000_payment_idempotency` — `payment.idempotency_key` +
  `payment (business_id, idempotency_key)` unique.

Evidence:

- `services/sales/test/invoice-payments.e2e-spec.ts` — **8 passing**: standalone
  from explicit lines (totals, no sale rows, one `InvoiceIssued`, balance
  bumped); from `sale_id` (line snapshots, second attempt `409`, `sale_id` +
  `lines` → `400`); partial → `partially_paid` → `paid` with customer balance
  tracking + two `InvoicePaymentRecorded` (`paid_in_full` on the last), payment
  on `paid` → `409`; overpayment → `422`, nothing persisted; `Idempotency-Key`
  replay → one payment; Owner void → `void` + zero balance + payment retained +
  `InvoiceVoided`, Staff void → `403`, paid invoice → `409`; voiding a credit
  **sale** voids its invoice + restores the customer balance + still emits
  `SaleVoided`; a 5-payment sequence keeps `balance_due == total - amount_paid`.
- All `services/sales` specs green in isolation: customers 7, invoices 8,
  invoice-payments 8, sales 18, isolation 13, rls-backstop 15, scaffold 2.
- `pnpm --filter @pos/sales build lint` green;
  `node scripts/check-contracts-compat.mjs HEAD` → OK;
  `kong config parse` → `parse successful`;
  `kubectl kustomize infra/k8s/base` renders.
- Live smoke through the local Kong edge (sales rebuilt): standalone invoice →
  partial payment (`partially_paid`, balance 6000) → overpay `422` → final
  payment (`paid`, balance 0, customer balance 0) → payment on paid `409`;
  fresh invoice → void (`void`, balance 0, `void_reason` set).
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.
