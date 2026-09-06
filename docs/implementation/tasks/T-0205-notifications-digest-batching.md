# T-0205 Notifications — Digest Batching Within `min_interval_hours`

## Status

- `pending`
- Last updated: 2026-09-06

## Linked Phase

- Phase 03 — Reorder Alerts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/integrations/notifications.md` (Digest flush, Low-stock rules), `docs/design/data/data-model.md` (`alert_config`, `notification`)
- Constraints: one digest email per business per window, listing every product currently `is_open`; window length = that business's `alert_config.min_interval_hours` (default 24); a lone dip still goes out at the next flush, not held a full interval when the window is already open; flush is time-driven (periodic timer or NATS scheduled message), interval = min active `min_interval_hours` (default hourly); flush work is idempotent and safe to run concurrently on multiple pods (row-level claim or advisory lock); `alert_config` is read via a projection or carried on the event — no sync call to `inventory`.
- Do not touch: `services/inventory`, edge detection, `EmailSender` internals (T-0204), `web/`, `mobile/`.

## Objective

Replace per-event low-stock emails with a per-business digest: batch all currently-low products into one email bounded by `alert_config.min_interval_hours`.

## Scope Boundary

**In scope:**
- `digest_window` state per business (`business_id`, `opened_at`, `flushed_at`, `min_interval_hours`) or equivalent columns on an existing table; opened when the first `queued` low-stock `notification` arrives with no open window.
- `min_interval_hours` projection in `notifications`: consume `alert-config` changes — either an `AlertConfigChanged` event added to `inventory` (additive contract) **or** carry `min_interval_hours` on `StockFellBelowThreshold`. Pick one; record the choice. Default 24 when unknown.
- `DigestFlushJob`: periodic; for each business whose window is due (`now - opened_at >= min_interval_hours` OR first-ever flush), collect its `queued` low-stock notifications whose product is still `is_open`, render one digest via `EmailSender`, mark those rows `sent` (+ `sent_at`), stamp `flushed_at`, close the window when nothing is still open.
- Products that recovered (`StockRecovered`, `is_open=false`) before flush are dropped from the digest and their `notification` row marked `superseded` (new `status` value) — not emailed.
- Concurrency-safe claim so two pods don't double-send.
- Tests with a controllable clock + capture `EmailSender`.

**Out of scope:**
- The single-notification create path — T-0204 (this task changes *when/how* they are sent, not their creation).
- Template bodies — T-0206.

## Acceptance Criteria

- Two products dipping within one business's `min_interval_hours` produce exactly one digest email listing both, sent at the flush.
- A single product dipping produces one digest email at the next flush (≤ `min_interval_hours` later, immediately if the window was already open and due).
- A product that dipped then recovered before the flush does not appear in the digest and its `notification` row is `superseded`, not `sent`.
- After a flush with all products recovered, the window is closed; a later dip opens a new window.
- Running `DigestFlushJob` twice for the same due window sends one email (claim/lock proven by a concurrent-invocation test).
- Changing `alert_config.min_interval_hours` to 1 shortens the window for that business only.

## Dependencies

- T-0204

## Implementation Checklist

1. Decide the `min_interval_hours` propagation mechanism; add the additive contract if needed.
2. `digest_window` state + open-on-first-queued logic.
3. `DigestFlushJob` timer + due-window selection + concurrency claim.
4. Digest assembly (still-open products only) + `EmailSender` send + row status transitions (`sent` / `superseded`).
5. `StockRecovered` path marks pending rows `superseded`.
6. Tests: two-product digest, lone dip, recover-before-flush, window reopen, concurrent flush, per-business interval.
7. `pnpm --filter @pos/notifications test`, `pnpm -r build/lint`; validator.

## Verification

- `services/notifications/test/*` covers all six acceptance criteria with an injected clock.
- `pnpm --filter @pos/notifications test` green; `pnpm -r build` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
