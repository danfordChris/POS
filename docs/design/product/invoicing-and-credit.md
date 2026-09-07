# Invoicing and Credit Sales

## Context

- Post-MVP capability, adopted 2026-09-07 (proposal `0004`), built in Phase 07.
- Extends cash sales (`docs/design/product/prd-mvp.md` §7) with a formal document,
  a named customer, and a receivables ledger. **No** payment gateway, mobile
  money, or fiscal/EFD device — a document and a balance only.
- Money is integer minor units + `currency`, as everywhere else in the model.
- All new tenant tables carry `business_id` + forced RLS.

## Requirements

### Customer

- Belongs to one business: `name` (required); optional `phone`, `email`,
  `address`, `tax_id`.
- `outstanding_balance` is **derived** — `sum(invoice.balance_due)` over that
  customer's non-void invoices — and cached on the row, maintained in the same
  transaction as any invoice/payment write (same pattern as
  `stock_item.quantity`).
- Create / edit / list / get. No delete while the customer has any non-void
  invoice; deactivation (`disabled_at`) instead.

### Invoice

- `number` — per-business sequence allocated from `invoice_number_counter` in the
  issuing transaction (row-locked `SELECT … FOR UPDATE`), same mechanism as
  `sale.number`.
- Sources:
  - **From a credit sale** — `POST /sales` with `payment_terms: credit` +
    `customer_id`. On completion the sale writes its stock movements as today
    **and** issues an `issued` invoice with `balance_due = total`, one
    `invoice_line` per sale line (snapshots carried over).
  - **Standalone** — `POST /invoices` with an explicit customer + lines (and an
    optional `sale_id` to attach to an existing cash sale). Standalone invoices
    do **not** move stock.
- Fields: `customer_id`, `sale_id?`, `status`, `currency`, `subtotal_minor`,
  `discount_minor`, `tax_minor`, `total_minor`, `amount_paid_minor`,
  `balance_due_minor`, `issue_date`, `due_date`, `public_token` (unguessable,
  ≥128-bit), `void_reason?`.
- `status`: `draft` → `issued` → `partially_paid` → `paid`; or `void` from any
  non-`paid` state. `draft` is only reachable via standalone create-without-issue
  (a follow-up; Phase 07 issues on create).
- `due_date` defaults to `issue_date + INVOICE_NET_DAYS` (env, default 14).
- Public view `GET /v1/i/{token}` — no auth; business name + line items +
  balances are snapshotted onto the invoice, not joined (same rule as `receipt`).

### Payment

- Recorded against one invoice: `amount_minor` (> 0), `method`
  (`cash | bank_transfer | mobile_money | other` — a label, no integration),
  `reference?`, `received_at`.
- Reduces `invoice.balance_due_minor` and the customer's cached
  `outstanding_balance`; when `balance_due` reaches 0 the invoice flips to
  `paid`, when it is between 0 and `total` it is `partially_paid`.
- `amount` greater than `balance_due` → `422 overpayment` (no change recorded).
- Paying a `void` or `paid` invoice → `409 invoice_not_payable`.
- Idempotent on `Idempotency-Key`.

### Void

- Voiding an invoice: `status = void`, `balance_due = 0`, the customer's
  outstanding balance drops by the old `balance_due`. Recorded payments are left
  in place (history); a note explains the reversal.
- Voiding the underlying **sale** (`POST /sales/{id}/void`) also voids its
  invoice by the same rule, in addition to the existing stock reversal.
- A `paid` invoice cannot be voided (issue a credit note — a follow-up).

### PDF

- The `media` service renders an invoice to a PDF from an HTML template, stores
  it in object storage (MinIO locally, S3 in prod), and records a `document`
  row. It consumes `InvoiceIssued`, and also serves a synchronous
  `pos.rpc.media.renderInvoice` for on-demand regeneration.
- `GET /v1/businesses/{id}/invoices/{id}/pdf` (member) and `GET /v1/i/{token}/pdf`
  (public) stream / redirect to the stored object. A not-yet-rendered invoice
  returns `202` with a `Retry-After`.
- `InvoiceDocumentReady` carries the object URL + size + sha-256.

### Accounts receivable

- `GET /v1/businesses/{id}/customers?has_balance=true` — customers who owe.
- `GET /v1/businesses/{id}/invoices?status=…&overdue=true` — filter open /
  overdue invoices.
- `invoice_issued` and `payment_received` transactional emails, and an
  `invoice_overdue` digest (internal daily sweep in `notifications`, cadence
  reuses `digest_config`), all en/sw. Recipient is the customer `email` when set
  (carried on the event); the Owner is always copied on the overdue digest.

### Roles

- Owner + Staff may create customers, issue invoices, and record payments.
- Void (invoice or sale) is **Owner-only**, matching sale void today.
- Price/discount authority on invoice lines follows the product rule (Owner-only
  price fields; server is the authority).
- Wingers: no access to any invoicing route.

## Decisions

- Invoices live in `sales` — they are a sale artifact and reuse the number
  counter, product cache, and void path. No separate `billing` service at this
  size.
- `media` becomes a real service now (invoice PDFs); `reporting` stays future.
- Credit is a **payment term on the sale**, not a separate flow — one sale model,
  one saga; the invoice is a side effect of completing a `credit` sale.
- Receivable balance is derived + cached, never hand-entered; the invoice ledger
  is the source of truth.
- No credit limit / block-on-overdue in Phase 07 (backlog).
- PDF generation is asynchronous (event-driven) with a synchronous RPC for
  regeneration; the read route degrades to `202` until the document exists.

## Contracts

- New `@pos/contracts` event schemas (`CustomerCreated`, `CustomerUpdated`,
  `InvoiceIssued`, `InvoicePaymentRecorded`, `InvoiceVoided`,
  `InvoiceDocumentReady`) + subjects; `SCHEMA_VERSION` minor bump; no removed
  keys (compat check stays green).
- Every new endpoint gets a happy-path + documented-error contract test.
- The public invoice payload is a fixed snapshot shape; a schema test asserts no
  internal identifiers leak (same guard as the winger payload).

## Acceptance Criteria

- A credit sale (`payment_terms: credit` + `customer_id`) returns `201`,
  decrements stock, and issues exactly one `issued` invoice with
  `balance_due == total` and a unique per-business `number`.
- `GET /v1/i/{token}` returns `200` without auth and `404` for an unknown/void
  token; the body carries no `cost_price`, member, or cross-customer fields.
- Recording payments that sum to `total` flips the invoice to `paid` and drops
  the customer's `outstanding_balance` to zero; an overpayment returns `422` and
  changes nothing.
- Voiding the sale voids its invoice and restores both stock and the customer
  balance.
- `GET /v1/businesses/{id}/invoices/{id}/pdf` returns a PDF once
  `InvoiceDocumentReady` has landed (`202` before that).
- `GET /v1/businesses/{id}/customers?has_balance=true` returns only customers of
  that business with a non-zero derived balance (cross-tenant `businessId` →
  empty; forced RLS).
- Isolation + RLS-backstop suites cover `customer`, `invoice`, `invoice_line`,
  `payment`, and `document`.
