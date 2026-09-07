# T-0601 Contracts + `sales` Invoicing Schema (models, migrations, RLS, events)

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: workflow-contract, backend
- Design docs: `docs/design/product/invoicing-and-credit.md`,
  `docs/design/data/data-model.md` (`customer`, `invoice`, `invoice_line`,
  `payment`, `invoice_number_counter`; balance invariants; indexes),
  `docs/design/interfaces/events-catalog.md` (`CustomerCreated`,
  `CustomerUpdated`, `InvoiceIssued`, `InvoicePaymentRecorded`, `InvoiceVoided`,
  `InvoiceDocumentReady`), `docs/design/interfaces/internal-rpc.md`
  (`pos.rpc.media.renderInvoice`)
- Constraints: additive contract change only — no removed/renamed zod keys
  (`check-contracts-compat.mjs` must stay green); bump `SCHEMA_VERSION` minor;
  money is integer minor units + `currency`; every new tenant table gets forced
  RLS via `enable_tenant_rls('<table>')` in the same migration; IDs UUID v7.
- Do not touch: any HTTP controller/service behaviour (endpoints land in
  T-0602–T-0604); `media`, `web`, `mobile`.

## Objective

Land the `@pos/contracts` event/RPC schemas and the `services/sales` Prisma
models + migrations (with forced RLS) for customers, invoices, invoice lines,
payments, and the invoice-number counter — with no endpoint or behaviour change.

## Scope Boundary

**In scope:**
- `@pos/contracts`: zod payloads + `SUBJECTS`/`EVENT_PAYLOADS` entries for
  `CustomerCreated`, `CustomerUpdated`, `InvoiceIssued`,
  `InvoicePaymentRecorded`, `InvoiceVoided`, `InvoiceDocumentReady`; a
  `renderInvoiceRequest` / `renderInvoiceResponse` pair + `SUBJECTS.media`;
  `SCHEMA_VERSION` minor bump; round-trip tests.
- `services/sales/prisma/schema.prisma`: `Customer`, `Invoice`, `InvoiceLine`,
  `Payment`, `InvoiceNumberCounter` models; add `paymentTerms`
  (`cash`|`credit`, default `cash`) + `customerId` (nullable) to `Sale`.
- One migration creating those tables + columns + indexes
  (`invoice (business_id, status, due_date)`, `invoice (public_token)`,
  `invoice (business_id, customer_id)`, `payment (business_id, invoice_id)`,
  `customer (business_id, name)`) and calling `enable_tenant_rls` on
  `customer`, `invoice`, `invoice_line`, `payment` (relaxed-read on `invoice`
  for the `/i/{token}` lookup, `WITH CHECK` strict — mirror the `receipt`
  public-read pattern).
- Prisma client regen; `pnpm --filter @pos/sales build` green.

**Out of scope:**
- Endpoints, services, consumers, the credit-sale path (T-0602–T-0604).
- The `media` `document` table (T-0605).

## Acceptance Criteria

- `@pos/contracts` exports the six event payloads + the `renderInvoice` RPC pair;
  `SCHEMA_VERSION` incremented by a minor; `pnpm --filter @pos/contracts test`
  green; `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `pnpm --filter @pos/sales exec prisma migrate deploy` applies cleanly on a
  fresh `sales` schema; `pnpm --filter @pos/sales exec prisma validate` passes.
- The migration calls `enable_tenant_rls` for `customer`, `invoice`,
  `invoice_line`, `payment`; a psql check with no `app.business_id` set returns
  zero rows from each.
- `pnpm --filter @pos/sales build` and existing `pnpm --filter @pos/sales test`
  remain green (no behaviour change).
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.

## Dependencies

- None beyond Phase 06 `done`.

## Implementation Checklist

1. Add the zod payloads + subjects + `EVENT_PAYLOADS` + `SCHEMA_VERSION` bump in
   `@pos/contracts`; round-trip tests.
2. Add the Prisma models + `Sale` columns in `services/sales`.
3. Write the migration (tables, indexes, `enable_tenant_rls`, relaxed-read
   policy on `invoice`).
4. `prisma generate`; build; run the existing sales suite.
5. `check-contracts-compat.mjs`; validator.

## Verification

_Planned — to be filled on completion:_

- `pnpm --filter @pos/contracts test` + `node scripts/check-contracts-compat.mjs HEAD`.
- `pnpm --filter @pos/sales exec prisma migrate deploy` on a clean schema +
  a psql RLS spot-check (no context → 0 rows).
- `pnpm --filter @pos/sales build test`.
- `validate_workflow.py` → `WORKFLOW:ok`.
