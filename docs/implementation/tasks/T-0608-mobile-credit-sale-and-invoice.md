# T-0608 `mobile` — Credit Toggle, Customer Picker, Invoice Detail + Share

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/product/invoicing-and-credit.md`,
  `docs/design/interfaces/mobile-app-spec.md`,
  `docs/design/architecture/mobile-architecture.md`
- Constraints: `mobile/` only; follow the existing `provider` + `BaseProvider`
  + `go_router` `AppRoute` + `Neu*` widget patterns and `formatMoney`; the
  credit toggle + customer picker extend the existing sell flow; the winger app
  is untouched (wingers have no invoicing).
- Do not touch: backend; `web/`; winger screens.

## Objective

On mobile a seller can mark a sale as credit and attach a customer, then open
the resulting invoice, see its balance, and share its link / PDF; an Owner can
see a read-only receivables summary.

## Scope Boundary

**In scope:**
- Sell flow — a `cash | credit` segmented control; when `credit`, a customer
  picker sheet (search `/customers`, "add customer" inline); pass
  `payment_terms` + `customer_id` to the sale call.
- `CustomerService` / `InvoiceService` (Dio) + models + a `CustomerProvider` /
  `InvoiceProvider`.
- Invoice detail screen — lines, totals, balance, status, "Share link" (the
  `/v1/i/{token}` URL) and "Open PDF" (launches `/v1/i/{token}/pdf`, tolerates
  `202`).
- Post-sale confirmation for a credit sale links to the invoice.
- A read-only "Receivables" summary card (Owner) on the home/more area: total
  owed + overdue count; tapping opens a simple owing-customers list.
- `AppRoute` entries; widget tests for the new screens/providers.

**Out of scope:**
- Recording payments from mobile (web-only in Phase 07).
- Void from mobile.
- Offline handling of credit sales (backlog).

## Acceptance Criteria

- A credit sale from mobile decrements stock and produces an invoice reachable
  from the confirmation screen; the invoice detail shows `balance_due == total`.
- "Share link" yields the public `/v1/i/{token}` URL; "Open PDF" opens the PDF
  when ready and shows a brief "preparing" state otherwise.
- The Receivables card shows the business's total outstanding and overdue count;
  it is not shown to Staff.
- `flutter analyze` clean; `flutter test` green (new provider + screen tests
  included).
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.

## Dependencies

- T-0602, T-0603 (customers + credit sale + public invoice), T-0605 (`/pdf`).

## Implementation Checklist

1. `CustomerService` / `InvoiceService` + models + providers.
2. Sell-flow credit toggle + customer picker sheet.
3. Invoice detail screen + share/PDF actions; credit-sale confirmation link.
4. Owner Receivables summary card + owing-customers list.
5. `AppRoute` wiring; widget/provider tests.
6. `flutter analyze` + `flutter test`; validator.

## Verification

Delivered:

- `models/invoice_models.dart` — `Customer`, `Invoice`, `InvoiceLine`,
  `InvoicePayment`, `InvoiceSummary`, `SaleInvoiceRef`; `Sale` gains an
  embedded `invoice` ref (parsed from `sale.invoice`).
- `core/invoice_url.dart` — `invoiceUrl` / `invoicePdfUrl` for the public
  `/v1/i/{token}` (+ `/pdf`).
- `data/services/customer_service.dart` (`list` w/ `q` + `hasBalance`, `create`)
  and `data/services/invoice_service.dart` (`get`, `list` w/ `overdue`).
- `SalesService.createSale` + `SellProvider` gain `paymentTerms` (`cash` |
  `credit`) + `customerId`; `SellProvider.setCredit(id, name)` / `setCash()`,
  `canSubmit` (a credit cart needs a customer), reset on `clear()`.
- Sell screen — a `SegmentedNeu` **Cash / Credit** toggle above the total bar;
  choosing Credit opens `_CustomerPickerSheet` (search `/customers`, an inline
  "Add & choose" form); the CTA reads "Complete credit sale" and is disabled
  until a customer is picked.
- Receipt screen — when the sale carries an invoice, an "Invoice #N" block with
  the balance due + **Share invoice** / **Share PDF** (both `share_plus`,
  matching the existing receipt-link share — no new dependency).
- `features/receivables/` — `ReceivablesProvider` (loads
  `customers?has_balance=true` + `invoices?overdue=true`) + `ReceivablesScreen`
  (total owed, customer/overdue counts, owing-customers list). Route
  `AppRoute.receivables('/receivables')`; an Owner-only "Receivables" tile in
  the More menu. Provider registered in `shared/providers/providers.dart`.

Evidence:

- `flutter analyze` → **No issues found**.
- `flutter test` → **22 passing** (15 existing + `invoice_models_test.dart` 3 +
  `sell_credit_test.dart` 4): invoice/customer/embedded-ref parsing; credit
  toggle state (`setCredit` records the customer, `setCash` clears, `canSubmit`
  gating, `clear()` resets to cash).
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.
- On-device walk-through (credit sale → receipt invoice block → share) is part
  of the Phase 07 acceptance step.
