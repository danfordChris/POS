# Phase 04 — Sales and Digital Receipts

## Status

- `pending`
- Last updated: 2026-09-01

## Objective

Record sales that decrement stock through the ledger, issue a public receipt link, and support void with full reversal.

## Scope

- `sale`, `sale_line`, `receipt` models + migration + RLS.
- `POST /sales` (transactional: lines → `sale` type movements → on-hand); `422 insufficient_stock` when short.
- Per-business `sale.number` sequence; price + name snapshots on lines.
- `POST /sales/{id}/void` → `void_reversal` movements, receipt `void`.
- `GET /r/{public_token}` public, unauthenticated.
- `GET /sales` (Owner all, Staff own), `GET /sales/{id}`.
- Mobile: sell flow, receipt screen (link + QR of link, share sheet).
- Web: sales table, sale detail, void.
- Idempotency-Key on `POST /sales`.

## Features

- Line-level optional discount; running total in the sell UI.
- Receipt view shows business name, lines, totals, timestamp; no internal IDs.

## Tasks

- [ ] T-0301 Sale/line/receipt models + migration + RLS
- [ ] T-0302 `POST /sales` transactional handler + idempotency
- [ ] T-0303 Insufficient-stock path (422, no partial writes)
- [ ] T-0304 Void handler + reversal movements
- [ ] T-0305 Public receipt endpoint + token generation
- [ ] T-0306 Sales read endpoints with role scoping
- [ ] T-0307 Mobile sell flow + 422 handling
- [ ] T-0308 Mobile receipt screen (link + QR + share)
- [ ] T-0309 Web sales list/detail/void

## Acceptance Criteria

- [ ] Completing a sale decreases on-hand per line and writes `sale` movements atomically.
- [ ] A sale exceeding on-hand returns 422 and creates no `sale` or `sale_line` rows.
- [ ] Void restores on-hand to pre-sale values for every line and marks the receipt `void`.
- [ ] `GET /r/{token}` returns 200 with no `Authorization` header; unknown/void token returns 404.
- [ ] Re-sending `POST /sales` with the same `Idempotency-Key` returns the original sale, not a duplicate.

## Blockers

- Phase 02 stock ledger must be `done`.

## Linked Tasks

- `docs/implementation/tasks/`
