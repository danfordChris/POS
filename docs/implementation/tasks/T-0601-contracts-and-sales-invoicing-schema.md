# T-0601 Contracts + `sales` Invoicing Schema (models, migrations, RLS, events)

## Status

- `done`
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

Delivered:

- `@pos/contracts` (additive): `subjects.ts` — `Context` widened with `'media'`;
  `SUBJECTS.sales` += `customerCreated` / `customerUpdated` / `invoiceIssued` /
  `invoicePaymentRecorded` / `invoiceVoided`; new `SUBJECTS.media`
  (`invoiceDocumentReady` evt + `renderInvoice` rpc). `events.ts` —
  `invoicePaymentMethod` enum + `customerCreatedPayload`,
  `customerUpdatedPayload`, `invoiceIssuedPayload`,
  `invoicePaymentRecordedPayload`, `invoiceVoidedPayload`,
  `invoiceDocumentReadyPayload`; all six added to `EVENT_PAYLOADS`. `rpc.ts` —
  `renderInvoiceRequest` / `renderInvoiceResponse` (`found` discriminator).
  `SCHEMA_VERSION` `1.2.0` → `1.3.0`. Round-trip specs added (2 new `it`s;
  `pnpm --filter @pos/contracts test` → 15).
- `services/sales/prisma/schema.prisma`: `Sale` += `paymentTerms`
  (`@default("cash")`) + `customerId` (nullable) + `invoice Invoice?`; new
  `Customer`, `Invoice`, `InvoiceLine`, `Payment`, `InvoiceNumberCounter`
  models with the design's indexes. `prisma validate` + `prisma format` clean;
  `prisma generate` OK.
- `services/sales/prisma/migrations/20260907160000_invoicing/migration.sql` —
  `ALTER TABLE sale ADD payment_terms/customer_id`; five `CREATE TABLE`s + FKs +
  indexes; `enable_tenant_rls` on `customer` / `invoice_line` / `payment` /
  `invoice_number_counter` (strict) and a hand-written relaxed-read
  `tenant_isolation` policy on `invoice` (mirrors `receipt`/`sale`).

Evidence:

- `node scripts/check-contracts-compat.mjs HEAD` → **OK** (no removed keys).
- `pnpm --filter @pos/contracts build test lint` → green (15 tests).
- `pnpm --filter @pos/nest-common --filter @pos/testing build test` → green
  (22 + 5) after the contracts bump.
- `prisma migrate deploy` applied all four sales migrations cleanly on a fresh
  scratch schema; `pg_policies` shows `tenant_isolation` (ALL, USING+CHECK) on
  all five new tables and `relforcerowsecurity = t` on each.
- RLS functional check as a non-superuser role, no `app.business_id` set:
  `customer` 0, `invoice_line` 0, `payment` 0, `invoice` **1** (relaxed read for
  the public `/i/{token}` lookup) — as designed.
- Migration applied to the local `sales` schema; `pnpm --filter @pos/sales
  build lint` green and the full existing suite `pnpm --filter @pos/sales test`
  → **48 passed** (no behaviour regression).
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.
