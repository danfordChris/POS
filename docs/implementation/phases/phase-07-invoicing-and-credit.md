# Phase 07 — Invoicing and Credit Sales

## Status

- `pending`
- Last updated: 2026-09-07

## Objective

Add a bounded invoicing + receivables capability on top of the MVP: named
customers, formal invoices (from a credit sale or standalone), payments against a
balance, a public invoice link, server-rendered invoice PDFs via a new `media`
service, and an accounts-receivable view — no payment gateway, no fiscal device.

## Scope

- **`@pos/contracts`** — `CustomerCreated`, `CustomerUpdated`, `InvoiceIssued`,
  `InvoicePaymentRecorded`, `InvoiceVoided`, `InvoiceDocumentReady` event
  schemas + subjects; `pos.rpc.media.renderInvoice` request/response;
  `SCHEMA_VERSION` minor bump; no removed keys.
- **`sales` schema** — `customer`, `invoice`, `invoice_line`, `payment`,
  `invoice_number_counter` models + migrations + forced RLS; `payment_terms` +
  `customer_id` on `sale`.
- **`sales` API** — customers CRUD + AR rollup; standalone invoices; payments
  (`422 overpayment`, `409 invoice_not_payable`, idempotent); invoice void;
  `GET /v1/i/{token}` public snapshot; the `POST /sales` credit path issuing an
  `issued` invoice with a per-business number; `POST /sales/{id}/void` also voids
  the invoice.
- **`media` service (new)** — scaffold (Dockerfile, CI matrix entry, compose +
  k8s, `/healthz` + `/readyz`), `document` model + RLS, an `InvoiceIssued`
  consumer + `renderInvoice` RPC, HTML→PDF rendering, MinIO/S3 storage,
  `InvoiceDocumentReady` emit; `GET /v1/businesses/{id}/invoices/{id}/pdf` +
  `GET /v1/i/{token}/pdf` proxied through Kong (`202` until rendered).
- **`notifications`** — `invoice_issued` + `payment_received` transactional
  emails and an `invoice_overdue` daily digest, en/sw; consumers for
  `InvoiceIssued` / `InvoicePaymentRecorded`.
- **`web`** — Customers screen; Invoices list + detail + record-payment; AR
  dashboard card; credit toggle + customer picker in the sale flow; PDF download.
- **`mobile`** — customer picker + credit toggle in the sell flow; invoice
  detail + share (link / PDF); read-only AR summary. Winger app untouched.
- **`infra`** — Kong routes for `/v1/businesses/{id}/customers`,
  `/v1/businesses/{id}/invoices`, `/v1/i/*`; `media` in compose + k8s;
  `infra/acceptance-smoke.sh` gains a credit-sale → invoice → PDF → payment →
  `paid` walk-through (U14/U15); isolation + RLS-backstop suites extended.

**Out of scope (backlog):**

- Credit limits / block-on-overdue; credit notes / refunds against a `paid`
  invoice; multi-currency on one invoice; `draft` invoice editing workflow;
  statement-of-account PDFs; SMS delivery of the invoice link; receipt PDFs
  (only invoices render in Phase 07).

## Features

- New product capability documented in `docs/design/product/invoicing-and-credit.md`
  (adopted 2026-09-07).
- New `media` service in the CI `service` matrix and the `acceptance` job.
- `docs/implementation/status/weekly-status.md` updated with the Phase 07 outcome.

## Design Notes (adopted 2026-09-07)

Proposal `0004-invoicing-and-credit-sales` was accepted as this phase and merged
into design; the proposal file was removed per the workflow lifecycle. Deltas:

- `docs/design/product/invoicing-and-credit.md` — new feature spec.
- `docs/design/data/data-model.md` — `customer`, `invoice`, `invoice_line`,
  `payment`, `invoice_number_counter` (`sales`), `document` (`media`);
  `sale.payment_terms` + `sale.customer_id`; balance invariants; indexes.
- `docs/design/interfaces/api-contract.md` — the `Invoicing & credit` endpoint
  block, the `POST /sales` extension, `customer_required` / `overpayment` /
  `invoice_not_payable` codes, public `/v1/i/{token}` (+ `/pdf`).
- `docs/design/interfaces/events-catalog.md` — the six new events; a `MEDIA`
  stream; the internal overdue sweep note.
- `docs/design/interfaces/internal-rpc.md` — `pos.rpc.media.renderInvoice`.
- `docs/design/architecture/service-decomposition.md` — `sales` ownership grows;
  new `media` service row; `notifications` consumes the invoice events; `media`
  schema + MinIO in the deployment notes.
- `docs/design/product/prd-mvp.md` — the deferred line drops "PDF invoices;
  credit sales / payment tracking" with a pointer to the new doc.

## Tasks

- [ ] T-0601 `@pos/contracts` + `sales` schema — customer / invoice / invoice_line / payment / counter models, migrations, forced RLS, events, `SCHEMA_VERSION` bump (no endpoints)
- [ ] T-0602 `sales` customers CRUD + accounts-receivable rollup endpoints
- [ ] T-0603 `sales` credit sale → invoice issuance (`payment_terms` on `POST /sales`, per-business numbering, `InvoiceIssued`, public `GET /v1/i/{token}`)
- [ ] T-0604 `sales` standalone invoices + payments + void (balance math, `InvoicePaymentRecorded` / `InvoiceVoided`, customer-balance maintenance, idempotency, sale-void → invoice-void)
- [ ] T-0605 `media` service — scaffold + `InvoiceIssued` consumer + `renderInvoice` RPC + HTML→PDF + MinIO/S3 + `InvoiceDocumentReady` + `document` table + Kong `/pdf` routes
- [ ] T-0606 `notifications` — `invoice_issued` / `payment_received` / `invoice_overdue` templates (en/sw) + consumers + overdue sweep
- [ ] T-0607 `web` — Customers, Invoices list/detail, record payment, AR dashboard card, credit toggle + customer picker in the sale flow, PDF download
- [ ] T-0608 `mobile` — customer picker + credit toggle in the sell flow, invoice detail + share, read-only AR summary
- [ ] T-0609 Isolation + RLS-backstop + acceptance — extend `services/sales` + new `services/media` isolation / rls-backstop specs; `acceptance-smoke.sh` credit-sale → invoice → PDF → payment walk-through (U14/U15); `acceptance-map.md`, phase acceptance, `weekly-status.md`

## Acceptance Criteria

- [ ] A `credit` sale (`payment_terms: credit` + `customer_id`) returns `201`, decrements stock, and issues exactly one `issued` invoice with `balance_due_minor == total_minor` and a unique per-business `number`; a `credit` sale with no `customer_id` returns `400 customer_required`.
- [ ] `GET /v1/i/{token}` returns `200` without an `Authorization` header and `404` for an unknown / `void` token; the payload validates against the fixed whitelist (no `cost_price`, member, or cross-customer fields).
- [ ] Payments summing to `total_minor` flip the invoice to `paid` and drop the customer's `outstanding_balance` to `0`; an overpayment returns `422 overpayment` and records nothing; paying a `void`/`paid` invoice returns `409 invoice_not_payable`.
- [ ] `POST /v1/businesses/{id}/sales/{id}/void` voids the linked invoice and restores both stock and the customer balance.
- [ ] `GET /v1/businesses/{id}/invoices/{id}/pdf` returns a `200` PDF once `InvoiceDocumentReady` has landed and `202` with `Retry-After` before that; `InvoiceDocumentReady` carries a resolvable object URL + `sha256`.
- [ ] `GET /v1/businesses/{id}/customers?has_balance=true` returns only that business's customers with a non-zero derived balance (cross-tenant `businessId` → empty; forced RLS).
- [ ] Isolation + RLS-backstop suites cover `customer`, `invoice`, `invoice_line`, `payment` (`sales`) and `document` (`media`); a query with no `app.business_id` returns zero rows.
- [ ] `node scripts/check-contracts-compat.mjs HEAD` → OK (additive only); `kong config parse` OK; `kubectl kustomize infra/k8s/base` renders.
- [ ] The CI `service` matrix runs `media`; the `acceptance` job walks the credit-sale → invoice → PDF → payment → `paid` path (U14/U15) and passes.
- [ ] `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.

## Blockers

- Phase 06 `done` (MVP `v0.1.0` tagged) — satisfied.

## Linked Tasks

- `docs/implementation/tasks/T-0601-*.md` … `T-0609-*.md`
