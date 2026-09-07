# T-0606 `notifications` — Invoice Issued / Payment Received / Overdue Digest

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/product/invoicing-and-credit.md` (Accounts
  receivable — emails), `docs/design/interfaces/events-catalog.md`
  (`InvoiceIssued`, `InvoicePaymentRecorded`; the internal overdue sweep note),
  `docs/design/integrations/notifications.md`
- Constraints: `services/notifications` only; mirror the existing template
  structure (`winger_authorized`, `invitation` — en/sw files + a
  `template-registry` renderer + a vars type); consumers use `subscribeWithDlq`,
  idempotent on `event_id`, deduped on a natural key; the overdue digest is an
  internal daily sweep (no event source) whose cadence reuses `digest_config`;
  recipient is the customer `email` from the event payload when set, and the
  overdue digest always also goes to the business owners (existing
  `notification_contact` projection).
- Do not touch: `sales`, `media`, `web`, `mobile`; other notification types.

## Objective

Send a localized `invoice_issued` email when an invoice is issued, a
`payment_received` email when a payment lands, and a daily `invoice_overdue`
digest to the customer and the business owners.

## Scope Boundary

**In scope:**
- Templates (en/sw) + `template-registry` renderers + vars types for
  `invoice_issued`, `payment_received`, `invoice_overdue`.
- `InvoiceIssuedConsumer` → `notification` row (`type: 'invoice_issued'`) + email
  (link to `/v1/i/{token}`; PDF link if `document_url` present later — link is
  fine if not). Dedupe key `invoice_issued:{invoice_id}`.
- `InvoicePaymentRecordedConsumer` → `notification` row
  (`type: 'payment_received'`) + email (amount, remaining balance, `paid_in_full`
  flag). Dedupe key `payment_received:{payment_id}`.
- An `invoice_overdue` sweep: a scheduled job that finds invoices past
  `due_date` with `balance_due > 0` (from a small `overdue_invoice` projection
  fed by `InvoiceIssued` / `InvoicePaymentRecorded` / `InvoiceVoided`, since
  `notifications` cannot read `sales`), groups by customer, and enqueues one
  digest per customer + one owner summary. Cadence from `digest_config`
  (`min_interval_hours`), deduped per `(customer_id, day)`.
- `notification.type` enum extended; migration for the projection table.
- e2e specs.

**Out of scope:**
- SMS delivery (deferred phase).
- Web/mobile surfacing (T-0607/T-0608).
- Any change to `sales` event payloads (must already carry `customer_email`,
  `locale`, `balance_due_minor`, `paid_in_full` from T-0601/T-0603/T-0604).

## Acceptance Criteria

- An `InvoiceIssued` event produces exactly one `invoice_issued` `notification`
  and one email in the payload's `locale` (falling back to English for an
  unknown locale); a duplicate `event_id` produces neither a second row nor a
  second send.
- An `InvoicePaymentRecorded` event produces one `payment_received` email
  showing the remaining balance and, when `paid_in_full`, a paid-in-full line.
- The overdue sweep, run against a set with one overdue and one current invoice,
  enqueues exactly one customer digest (for the overdue one) and one owner
  summary; a second run within `min_interval_hours` enqueues nothing.
- No email is enqueued when the event carries no `customer_email` **and** the
  type is not the owner-summary (customer-only mails are skipped, not errored).
- `pnpm --filter @pos/notifications build test lint` green;
  `check-contracts-compat.mjs HEAD` OK; `validate_workflow.py` → `WORKFLOW:ok`.

## Dependencies

- T-0601 (contracts), T-0603 (`InvoiceIssued` emitted), T-0604
  (`InvoicePaymentRecorded` / `InvoiceVoided` emitted).

## Implementation Checklist

1. Templates + registry renderers + vars types (en/sw) for the three types.
2. `overdue_invoice` projection table + migration + its consumers.
3. `InvoiceIssuedConsumer`, `InvoicePaymentRecordedConsumer`.
4. The overdue sweep job (cadence from `digest_config`, per-customer dedupe).
5. Extend `notification.type`; wire modules into `app.module.ts`.
6. e2e (issued email + idempotency; payment email; overdue sweep once/twice;
   missing-email skip); build/test/lint; compat; validator.

## Verification

_Planned — to be filled on completion:_

- `pnpm --filter @pos/notifications test` (new invoice email + overdue-sweep
  specs) + `build` + `lint`.
- Live smoke: issue a credit sale → Mailpit shows the `invoice_issued` mail with
  the `/v1/i/{token}` link; record a payment → `payment_received` mail.
- `node scripts/check-contracts-compat.mjs HEAD`; `validate_workflow.py` →
  `WORKFLOW:ok`.
