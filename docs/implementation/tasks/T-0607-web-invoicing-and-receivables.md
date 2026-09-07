# T-0607 `web` — Customers, Invoices, Payments, AR Dashboard

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: workflow-contract (frontend follows the existing `web/` patterns)
- Design docs: `docs/design/product/invoicing-and-credit.md`,
  `docs/design/interfaces/api-contract.md` (`Invoicing & credit`),
  `docs/design/interfaces/web-app-spec.md`
- Constraints: `web/` only; use the existing `tenantGet` / server-action pattern
  and the shell layout; money via the shared formatter; Owner-only controls
  (void, price fields) gated the same way as existing screens; the credit toggle
  + customer picker live in the existing sale flow, not a new page.
- Do not touch: backend services; `mobile/`.

## Objective

Web users can manage customers, raise and view invoices, record payments, see an
accounts-receivable summary on the dashboard, mark a sale as credit with a
customer, and download an invoice PDF.

## Scope Boundary

**In scope:**
- `web/app/(shell)/customers/` — list (search, `has_balance` filter), detail
  (contact fields, outstanding balance, invoice history), create/edit form.
- `web/app/(shell)/invoices/` — list (status / customer / overdue filters),
  detail (lines, balances, payments, status), a "Record payment" form, an
  Owner-only "Void" action, a "Download PDF" button (handles the `202` with a
  retry/poll).
- Sale flow — a `cash | credit` toggle; when `credit`, a customer picker
  (searches `/customers`, inline "new customer"); submits `payment_terms` +
  `customer_id`.
- Dashboard — an "Owed to you" card: total receivable + count of overdue
  invoices, linking to `/invoices?overdue=true`.
- Server actions for the new POSTs; `web/lib/models.ts` types.
- Navigation entries for Customers + Invoices.

**Out of scope:**
- Draft-invoice editing; credit notes; statement export.
- Backend changes.

## Acceptance Criteria

- Creating a customer, then a credit sale for that customer, shows the new
  invoice on `/invoices` and the balance on the customer detail and the
  dashboard card.
- "Record payment" for the full balance flips the invoice to `paid` in the UI
  and zeroes the customer balance; an overpayment surfaces the `422 overpayment`
  message inline.
- The "Void" action is visible only to an Owner and updates the invoice to
  `void`.
- "Download PDF" retrieves the PDF once available and shows a "generating…" state
  on `202`.
- `pnpm --filter web lint` and `pnpm --filter web build` pass.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.

## Dependencies

- T-0602, T-0603, T-0604 (endpoints), T-0605 (`/pdf`).

## Implementation Checklist

1. `customers` route group (list/detail/form) + server actions.
2. `invoices` route group (list/detail) + record-payment + void actions + PDF
   download with `202` polling.
3. Sale-flow credit toggle + customer picker.
4. Dashboard "Owed to you" card.
5. `models.ts` types; nav entries.
6. `pnpm --filter web lint build`; validator.

## Verification

_Planned — to be filled on completion:_

- `pnpm --filter web lint` + `pnpm --filter web build`.
- Manual walk-through against the local stack: customer → credit sale → invoice
  → payment → paid; PDF download; dashboard card.
- `validate_workflow.py` → `WORKFLOW:ok`.
