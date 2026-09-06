# T-0303 Sales — Insufficient-Stock Path

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (`422 insufficient_stock`), `docs/design/interfaces/internal-rpc.md` (`reserveStock` shortfalls), `docs/design/data/data-model.md` (no partial writes)
- Constraints: `reserveStock` returning `{ ok: false, shortfalls: [...] }` → `422 insufficient_stock` with the envelope `details` naming the short products; **no** `sale` / `sale_line` / `receipt` / `SaleCompleted` rows; **no** `releaseReservation` call (nothing was reserved); the response never leaks another tenant's data.
- Do not touch: `services/inventory`, `catalog`, `web/`, `mobile/`.

## Objective

Make `POST /sales` reject an over-quantity sale with `422 insufficient_stock` and zero writes.

## Scope Boundary

**In scope:**
- In `SalesService.createSale`: when `reserveStock` returns `ok: false`, throw `UnprocessableEntityException` with `code: 'insufficient_stock'`, a user-safe `message`, and `details: shortfalls.map(s => ({ field: 'lines', issue: '<product_id> short: available <n>' }))`.
- Guarantee (assert in tests) that the transaction that writes `sale` rows is only entered on `ok: true`.
- e2e in `services/sales/test/`.

**Out of scope:**
- The happy-path saga — T-0302.
- Retry/backoff on transport errors — that is `503`, not `422` (T-0302).

## Acceptance Criteria

- `POST /sales` whose lines exceed on-hand (stub `reserveStock` → `{ ok: false, shortfalls: [{ product_id, available }] }`) returns `422` with `error.code === 'insufficient_stock'` and `error.details` listing the short product(s).
- After that `422`, `sale`, `sale_line`, `receipt`, and `outbox` (for `SaleCompleted`) tables have **zero** new rows for the business.
- `releaseReservation` is **not** called on the `422` path.
- A partially-short cart (one line fits, one does not) still returns `422` and writes nothing.

## Dependencies

- T-0302

## Implementation Checklist

1. Map `reserveStock` `{ ok: false }` → `422 insufficient_stock` with `details`.
2. Ensure the write txn is unreachable unless `ok: true`.
3. e2e: fully short, partially short → 422 + zero rows + no release.
4. `pnpm --filter @pos/sales test`, `pnpm -r build/lint`; validator.

## Verification

- `services/sales/test/*` asserts `422 insufficient_stock`, zero rows, no `releaseReservation`.
- `pnpm --filter @pos/sales test` green; `pnpm -r build` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
