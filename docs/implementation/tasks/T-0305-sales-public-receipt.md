# T-0305 Sales — Public Receipt Endpoint

## Status

- `done`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (`GET /r/{public_token}`, "unauthenticated", Decisions: "Receipt route lives at `/v1/r/{token}` (short) and is unauthenticated"), `docs/design/data/data-model.md` (`receipt` — `public_token` ≥128-bit, `business_name_snapshot`), `docs/design/interfaces/mobile-app-spec.md` (Receipt screen)
- Constraints: `GET /v1/r/{token}` is fully public — Kong route with **no** `pos-internal-context` plugin; the handler runs with **no** tenant context and looks the receipt up by `public_token` only (unguessable, so this is safe); the payload carries business name, line snapshots, totals, currency, timestamp and **no** internal IDs (`business_id`, `sale_id`, `product_id`, `user_id` all omitted); an unknown token **or** a `void` receipt → `404 not_found`; `public_token` is generated from a CSPRNG (≥128 bits, URL-safe).
- Do not touch: `services/inventory`, `catalog`, `web/`, `mobile/`.

## Objective

Serve the unauthenticated `GET /v1/r/{public_token}` receipt view from `sales`.

## Scope Boundary

**In scope:**
- Token generation in `sales` at sale time (T-0302 writes the `receipt`; this task owns the generator util — `crypto.randomBytes(16)` base64url — and swaps it in if T-0302 used a placeholder).
- `ReceiptController` `GET /r/:token` — **no** guards, `@Public()` (or simply not under the tenant controller); reads `receipt` + `sale` + `sale_line` by token, bypassing RLS via a dedicated unscoped query path (raw SQL or a `receipt`-by-token read that does not require `app.business_id`). Document the RLS handling.
- Response shape `{ number, issued_at, status, business_name, currency, lines: [{ name, unit_price, quantity, discount, line_total }], subtotal, discount_total, total }` — asserted by a schema test to contain no `*_id` fields.
- Kong: `~/v1/r/[^/]+` route on the `sales` service **without** the `pos-internal-context` plugin, in `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`.
- e2e.

**Out of scope:**
- QR rendering — mobile (T-0308) / web (T-0309) render the QR from the link.
- Rate limiting on `/r/*` — Phase 06 hardening.

## Acceptance Criteria

- `GET /v1/r/{token}` for an `issued` receipt returns `200` with **no** `Authorization` header required and the documented payload.
- The response body contains no `business_id`, `sale_id`, `product_id`, `user_id`, or `receipt.id`.
- An unknown token → `404 not_found`; a token whose `receipt.status = 'void'` → `404 not_found`.
- `public_token` is ≥128 bits of CSPRNG entropy, URL-safe, and unique (DB constraint).
- `kong config parse` passes; the `/r` route has no `pos-internal-context` plugin.

## Dependencies

- T-0302 (writes the `receipt` row), T-0304 (void → 404)

## Implementation Checklist

1. `public_token` generator util + wire into the sale write.
2. `ReceiptController` `GET /r/:token` (no guards) + unscoped token lookup + RLS note.
3. Response mapper (snapshots only, no ids) + schema test.
4. Kong `/r` route without the internal-context plugin.
5. e2e: issued → 200 no-auth, unknown → 404, void → 404, no-id assertion.
6. `pnpm --filter @pos/sales test`, `pnpm -r build/lint`, `kong config parse`; validator.

## Verification

Delivered:

- `ReceiptController` `GET /r/:token` — **no guards**; `SalesService.publicReceipt`
  does an unscoped `prisma.receipt.findUnique({ where: { publicToken } })` with
  `sale` + `sale_line` included; returns `null` (→ `404 not_found`) for an
  unknown token or a `status = 'void'` receipt.
- **RLS handling** (migration `20260907140000_public_receipt_read`): the *USING*
  clause on `receipt`, `sale`, `sale_line` is relaxed to also permit an unscoped
  context (`app.business_id` unset) — the only unscoped reader is this public
  handler, and it filters by the ≥128-bit `public_token`. *WITH CHECK* stays
  strict, so every write is still tenant-scoped.
- `public_token` = `randomBytes(16).base64url` (the `src/sales/public-token.ts`
  util from T-0302 — 128 bits, URL-safe, DB-unique).
- Response mapper: `{ number, issued_at, status, business_name, currency,
  lines: [{ name, unit_price, quantity, discount, line_total }], subtotal,
  discount_total, total }` — snapshots only, no `*_id`.
- Kong: `~/v1/r/[^/]+` route on the `sales` service **without**
  `pos-internal-context`, in `infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`.

Evidence:

- `pnpm --filter @pos/sales test` → 16 (3 new): issued receipt → `200` with **no
  Authorization header**, correct totals + line snapshots, body contains no
  `business_id` / `sale_id` / `product_id` / `user_id` / `"id"`; unknown token
  → `404 not_found`; a voided sale's receipt → `404`.
- `kong config parse` → `parse successful`; the `receipt-public` route has no
  plugin.
- Backend suites green: sales 16, inventory 24, notifications 22 (+ contracts 10,
  nest-common 16, testing 5, identity 7, tenancy 9, catalog 11).
- `pnpm --filter @pos/sales build` + `lint` clean; `prettier` clean.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
